const mongoose = require('mongoose');
const WBS = require('../models/wbs');
const Project = require('../models/project');
const UserProfile = require('../models/userProfile');
const TaskChangeLog = require('../models/taskChangeLog');
const TaskChangeTracker = require('../middleware/taskChangeTracker');
const taskHelper = require('../helpers/taskHelper')();
const { hasPermission } = require('../utilities/permissions');
const emailSender = require('../utilities/emailSender');
const followUp = require('../models/followUp');
const logger = require('../startup/logger');

const taskController = function (Task) {
  const getTasks = (req, res) => {
    const { level } = req.params;

    let query = {
      wbsId: { $in: [req.params.wbsId] },
      level: { $in: [level] },
      isActive: { $ne: false },
    };

    const { mother } = req.params;

    if (mother !== '0') {
      query = {
        wbsId: { $in: [req.params.wbsId] },
        level: { $in: [level] },
        mother: { $in: [mother] },
      };
    }

    Task.find(query)
      .populate('createdBy', 'firstName lastName email') // <-- added
      .lean()
      .then((results) => {
        const withCreator = results.map((t) => ({
          ...t,
          creatorName: t.createdBy
            ? [t.createdBy.firstName, t.createdBy.lastName].filter(Boolean).join(' ').trim()
            : undefined,
        }));
        return res.status(200).send(withCreator);
      })
      .catch((error) => res.status(404).send(error));
  };

  const getWBSId = (req, res) => {
    const { wbsId } = req.params;

    WBS.findById(wbsId)
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  const updateSumUp = (
    taskId,
    hoursBest,
    hoursWorst,
    hoursMost,
    hoursLogged,
    estimatedHours,
    resources,
  ) => {
    Task.findById(taskId, (error, task) => {
      task.hoursBest = hoursBest;
      task.hoursMost = hoursMost;
      task.hoursWorst = hoursWorst;
      task.hoursLogged = hoursLogged;
      task.estimatedHours = estimatedHours;
      task.resources = resources;
      task.save();
    });
  };

  const updateDateTime = (taskId, startedDatetime, dueDatetime) => {
    Task.findById(taskId, (error, task) => {
      task.startedDatetime = startedDatetime;
      task.dueDatetime = dueDatetime;
      task.save();
    });
  };

  const updatePriority = (taskId, priority) => {
    Task.findById(taskId, (error, task) => {
      task.priority = priority;
      task.save();
    });
  };

  const updateAssigned = (taskId, isAssigned) => {
    Task.findById(taskId, (error, task) => {
      task.isAssigned = isAssigned;
      task.save();
    });
  };

  const calculateSubTasks = (level, tasks) => {
    const parentTasks = tasks.filter((task) => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter((taskChild) => taskChild.level === level + 1);
      let sumHoursBest = 0;
      let sumHoursWorst = 0;
      let sumHoursMost = 0;
      let sumHoursLogged = 0;
      let sumEstimatedHours = 0;
      const resources = [];
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task.taskId)) {
          hasChild = true;
          sumHoursBest = parseFloat(childTask.hoursBest, 10) + parseFloat(sumHoursBest, 10);
          sumHoursWorst = parseFloat(childTask.hoursWorst, 10) + parseFloat(sumHoursWorst, 10);
          sumHoursMost = parseFloat(childTask.hoursMost, 10) + parseFloat(sumHoursMost, 10);
          sumHoursLogged = parseFloat(childTask.hoursLogged, 10) + parseFloat(sumHoursLogged, 10);
          sumEstimatedHours =
            parseFloat(childTask.estimatedHours, 10) + parseFloat(sumEstimatedHours, 10);
          childTask.resources.forEach((member) => {
            let isInResource = false;
            resources.forEach((mem) => {
              if (member.userID.equals(mem.userID)) {
                isInResource = true;
              }
            });
            if (!isInResource) {
              resources.push(member);
            }
          });
        }
      });

      if (hasChild) {
        tasks.forEach((mainTask, i) => {
          if (mainTask._id.equals(task._id)) {
            tasks[i].hoursBest = sumHoursBest;
            tasks[i].hoursMost = sumHoursMost;
            tasks[i].hoursWorst = sumHoursWorst;
            tasks[i].hoursLogged = sumHoursLogged;
            tasks[i].estimatedHours = sumEstimatedHours;
            tasks[i].resources = resources;
          }
        });
        updateSumUp(
          task._id,
          sumHoursBest,
          sumHoursWorst,
          sumHoursMost,
          sumHoursLogged,
          sumEstimatedHours,
          resources,
        );
      }
    });
    return tasks;
  };

  const setDatesSubTasks = (level, tasks) => {
    const parentTasks = tasks.filter((task) => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter((taskChild) => taskChild.level === level + 1);
      let minStartedDate = task.startedDatetime;
      let maxDueDatetime = task.dueDatetime;
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task.taskId)) {
          hasChild = true;
          if (minStartedDate > childTask.startedDatetime) {
            minStartedDate = childTask.startedDatetime;
          }
          if (maxDueDatetime < childTask.dueDatetime) {
            maxDueDatetime = childTask.dueDatetime;
          }
        }
      });

      if (hasChild) {
        tasks.forEach((mainTask, i) => {
          if (mainTask._id.equals(task._id)) {
            tasks[i].startedDatetime = minStartedDate;
            tasks[i].dueDatetime = maxDueDatetime;
          }
        });
        updateDateTime(task._id, minStartedDate, maxDueDatetime);
      }
    });
    return tasks;
  };

  const calculatePriority = (level, tasks) => {
    const parentTasks = tasks.filter((task) => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter((taskChild) => taskChild.level === level + 1);
      let totalNumberPriority = 0;
      let totalChild = 0;
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task.taskId)) {
          hasChild = true;
          totalChild += 1;
          if (childTask.priority === 'Primary') {
            totalNumberPriority += 3;
          } else if (childTask.priority === 'Secondary') {
            totalNumberPriority += 2;
          } else if (childTask.priority === 'Tertiary') {
            totalNumberPriority += 1;
          }
        }
      });

      if (hasChild) {
        let { priority } = task;

        tasks.forEach((mainTask) => {
          if (mainTask._id.equals(task._id)) {
            const avg = totalNumberPriority / totalChild;
            if (avg <= 1.6) {
              priority = 'Tertiary';
            } else if (avg > 1.6 && avg < 2.5) {
              priority = 'Secondary';
            } else {
              priority = 'Primary';
            }
          }
        });
        updatePriority(task._id, priority);
      }
    });
    return tasks;
  };

  const setAssigned = (level, tasks) => {
    const parentTasks = tasks.filter((task) => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter((taskChild) => taskChild.level === level + 1);
      let isAssigned = false;
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task.taskId)) {
          hasChild = true;
          if (childTask.isAssigned) {
            isAssigned = true;
          }
        }
      });

      if (hasChild) {
        tasks.forEach((mainTask, i) => {
          if (mainTask._id.equals(task._id)) {
            tasks[i].isAssigned = isAssigned;
          }
        });
        updateAssigned(task._id, isAssigned);
      }
    });
    return tasks;
  };

  const setStatus = (level, tasks) => tasks;

  const updateParents = (wbsId, parentId1) => {
    Task.find({
      $and: [
        { $or: [{ taskId: parentId1 }, { parentId1 }, { parentId1: null }] },
        { wbsId: { $in: [wbsId] } },
        { isActive: { $ne: false } },
      ],
    }).then((tasks) => {
      tasks = [...new Set(tasks.map((item) => item))];
      for (let lv = 3; lv > 0; lv -= 1) {
        calculateSubTasks(lv, tasks);
        setDatesSubTasks(lv, tasks);
        calculatePriority(lv, tasks);
        setAssigned(lv, tasks);
        setStatus(lv, tasks);
      }
    });
  };

  const fixTasksLocal = (tasks) => {
    // (unchanged)
    const tasksWithId = tasks.map((task) => {
      const _id = new mongoose.Types.ObjectId();
      const resources = task.resources.map((resource) => {
        const [name, userID, profilePic] = resource.split('|');
        return { name, userID, profilePic };
      });

      return {
        ...task,
        _id,
        resources,
      };
    });

    tasksWithId.forEach((task) => {
      const taskNumArr = task.num.split('.');
      switch (task.level) {
        case 1:
          task.parentId1 = null;
          task.parentId2 = null;
          task.parentId3 = null;
          task.mother = null;
          break;
        case 2:
          task.parentId1 = tasksWithId.find((pTask) => pTask.num === taskNumArr[0])._id;
          task.parentId2 = null;
          task.parentId3 = null;
          task.mother = task.parentId1;
          break;
        case 3:
          task.parentId1 = tasksWithId.find((pTask) => pTask.num === taskNumArr[0])._id;
          task.parentId2 = tasksWithId.find(
            (pTask) => pTask.num === `${taskNumArr[0]}.${taskNumArr[1]}`,
          )._id;
          task.parentId3 = null;
          task.mother = task.parentId2;
          break;
        case 4:
          task.parentId1 = tasksWithId.find((pTask) => pTask.num === taskNumArr[0])._id;
          task.parentId2 = tasksWithId.find(
            (pTask) => pTask.num === `${taskNumArr[0]}.${taskNumArr[1]}`,
          )._id;
          task.parentId3 = tasksWithId.find(
            (pTask) => pTask.num === `${taskNumArr[0]}.${taskNumArr[1]}.${taskNumArr[2]}`,
          )._id;
          task.mother = task.parentId3;
          break;
        default:
      }
    });

    const tasksFromSameLevelArr = Array(4)
      .fill(null)
      .map(() => []);

    tasksWithId.forEach((task) => {
      tasksFromSameLevelArr[task.level - 1].push(task);
    });

    tasksFromSameLevelArr.reverse().forEach((tasksFromSameLevel, i) => {
      if (i === 0) {
        tasksFromSameLevel.forEach((task) => {
          task.hasChild = false;
          task.childrenQty = 0;
        });
      } else {
        tasksFromSameLevel.forEach((task) => {
          let priorityPts = 0;
          tasksFromSameLevelArr[i - 1].forEach((childTask) => {
            if (childTask.mother === task._id) {
              task.hasChild = true;
              task.hoursBest += childTask.hoursBest;
              task.hoursWorst += childTask.hoursWorst;
              task.hoursMost += childTask.hoursMost;
              task.hoursLogged += childTask.hoursLogged;
              task.estimatedHours += childTask.estimatedHours;
              task.startedDatetime = Math.min(task.startedDatetime, childTask.startedDatetime);
              task.dueDatetime = Math.max(task.dueDatetime, childTask.dueDatetime);
              task.childrenQty = (task.childrenQty || 0) + 1;
              task.isAssigned = task.isAssigned || childTask.isAssigned;
              task.resources = childTask.resources.reduce(
                (resources, childTaskMember) => {
                  if (task.resources.every((member) => member.name !== childTaskMember.name))
                    return [...resources, childTaskMember];
                  return resources;
                },
                [...task.resources],
              );
              if (childTask.priority === 'Primary') {
                priorityPts += 3;
              } else if (childTask.priority === 'Secondary') {
                priorityPts += 2;
              } else {
                priorityPts += 1;
              }
            }
          });
          const averagePts = priorityPts / task.childrenQty;
          if (averagePts >= 2.5) {
            task.priority = 'Primary';
          } else if (averagePts >= 1.6) {
            task.priority = 'Secondary';
          } else {
            task.priority = 'Tertiary';
          }
        });
      }
    });
    return tasksFromSameLevelArr.flat();
  };

  const importTask = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'importTask'))) {
      res.status(403).send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    const wbsId = req.params.id;
    const taskList = req.body.list;
    const fixedTasks = fixTasksLocal(taskList);

    fixedTasks.forEach((task) => {
      const createdDatetime = Date.now();
      const modifiedDatetime = Date.now();
      const _task = new Task({
        ...task,
        wbsId,
        createdDatetime,
        modifiedDatetime,
        createdBy: req.body?.requestor?.requestorId || undefined, // <-- set if available
      });

      _task
        .save()
        .then()
        .catch((ex) => {
          res.status(400).send(ex);
        });
    });

    res.status(201).send('done');
  };

  const postTask = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'postTask'))) {
      return res.status(403).send({ error: 'You are not authorized to create new Task.' });
    }

    if (!req.body.taskName || !req.body.isActive) {
      return res.status(400).send({
        error: 'Task Name, Active status are mandatory fields',
      });
    }

    const wbsId = req.params.id;
    const task = req.body;
    const createdDatetime = Date.now();
    const modifiedDatetime = Date.now();

    const parentId = task.mother;
    let level = 1;
    let num = '';

    try {
      if (parentId) {
        const parentTask = await Task.findById(parentId);
        if (!parentTask) {
          return res.status(400).send({ error: 'Invalid parent task ID provided.' });
        }

        level = parentTask.level + 1;
        const siblings = await Task.find({ mother: parentId });
        const nextIndex = siblings.length
          ? Math.max(...siblings.map((s) => parseInt(s.num.split('.')[level - 1] || 0, 10))) + 1
          : 1;

        const baseNum = parentTask.num
          .split('.')
          .slice(0, level - 1)
          .join('.');
        num = baseNum ? `${baseNum}.${nextIndex}` : `${nextIndex}`;
      } else {
        const topTasks = await Task.find({ wbsId, level: 1 });
        const nextTopNum = topTasks.length
          ? Math.max(...topTasks.map((t) => parseInt(t.num.split('.')[0] || 0, 10))) + 1
          : 1;
        num = `${nextTopNum}`;
      }

      // Determine category flags
      let categoryOverride = false;
      let categoryLocked = false;

      // Check if task category differs from project category
      try {
        const currentWBS = await WBS.findById(wbsId);
        if (currentWBS) {
          const currentProject = await Project.findById(currentWBS.projectId);
          if (currentProject) {
            const taskCategory = task.category || 'Unspecified';
            const projectCategory = currentProject.category || 'Unspecified';

            if (taskCategory !== projectCategory) {
              // Task category differs from project
              categoryOverride = true;
              categoryLocked = true; // Lock it since user explicitly chose different category
              logger.logInfo(
                `[postTask] New task category "${taskCategory}" differs from project category "${projectCategory}" - setting override=TRUE, locked=TRUE`,
              );
            } else {
              // Task category matches project
              categoryOverride = false;
              categoryLocked = false; // Unlocked so it can cascade with project changes
              logger.logInfo(
                `[postTask] New task category "${taskCategory}" matches project category "${projectCategory}" - setting override=FALSE, locked=FALSE`,
              );
            }
          }
        }
      } catch (err) {
        logger.logException(err);
        // Default to false/false if we can't determine
        categoryOverride = false;
        categoryLocked = false;
      }

      // Allow explicit override from request body (for testing or special cases)
      if (task.categoryOverride !== undefined) {
        categoryOverride = task.categoryOverride;
      }
      if (task.categoryLocked !== undefined) {
        categoryLocked = task.categoryLocked;
      }

      logger.logInfo(
        `[postTask] Creating new task with categoryOverride=${categoryOverride}, categoryLocked=${categoryLocked}`,
      );

      const _task = new Task({
        ...task,
        wbsId,
        num,
        level,
        createdDatetime,
        modifiedDatetime,
        createdBy: req.body?.requestor?.requestorId || undefined, // <-- set creator
      });

      const saveTask = _task.save();
      const saveWbs = WBS.findById(wbsId).then((currentwbs) => {
        currentwbs.modifiedDatetime = Date.now();
        return currentwbs.save();
      });
      const saveProject = WBS.findById(wbsId).then((currentwbs) => {
        Project.findById(currentwbs.projectId).then((currentProject) => {
          currentProject.modifiedDatetime = Date.now();
          return currentProject.save();
        });
      });

      Promise.all([saveTask, saveWbs, saveProject])
        .then(async ([savedTask]) => {
          const populatedTask = await Task.findById(savedTask._id)
            .populate('createdBy', 'firstName lastName email') // <-- populate before sending
            .lean();

          console.log(
            '✅ Task created by:',
            populatedTask?.createdBy
              ? `${populatedTask.createdBy.firstName || ''} ${populatedTask.createdBy.lastName || ''}`.trim()
              : 'Unknown',
          );

          return res.status(201).send(populatedTask);
        })
        .catch((errors) => {
          res.status(400).send(errors);
        });
    } catch (err) {
      console.error('Error creating task:', err);
      return res.status(500).send({ error: 'Internal server error.', details: err.message });
    }
  };

  const updateNum = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'updateNum'))) {
      res.status(403).send({ error: 'You are not authorized to create new projects.' });
      return;
    }

    if (!req.body.nums) {
      res.status(400).send({ error: 'Num is a mandatory fields' });
      return;
    }

    const listOfNums = req.body.nums;
    listOfNums.forEach((elm) => {
      Task.findById(elm.id, (error, task) => {
        task.num = elm.num;
        task
          .save()
          .then()
          .catch((errors) => res.status(400).send(errors));
      });

      // level 2
      Task.find({ parentId: { $in: [elm.id] } })
        .then((childTasks1) => {
          if (childTasks1.length > 0) {
            childTasks1.forEach((childTask1) => {
              childTask1.num = childTask1.num.replace(
                childTask1.num.substring(0, elm.num.length),
                elm.num,
              );

              childTask1
                .save()
                .then(true)
                .catch((errors) => res.status(400).send(errors));

              // level 3
              Task.find({ parentId: { $in: [childTask1._id] } })
                .then((childTasks2) => {
                  if (childTasks2.length > 0) {
                    childTasks2.forEach((childTask2) => {
                      childTask2.num = childTask2.num.replace(
                        childTask2.num.substring(0, childTask1.num.length),
                        childTask1.num,
                      );

                      childTask2
                        .save()
                        .then(true)
                        .catch((errors) => res.status(400).send(errors));

                      // level 4
                      Task.find({ parentId: { $in: [childTask2._id] } })
                        .then((childTasks3) => {
                          if (childTasks3.length > 0) {
                            childTasks3.forEach((childTask3) => {
                              childTask3.num = childTask3.num.replace(
                                childTask3.num.substring(0, childTask2.num.length),
                                childTask2.num,
                              );

                              childTask3
                                .save()
                                .then(true)
                                .catch((errors) => res.status(400).send(errors));
                            });
                          }
                        })
                        .catch((error) => res.status(404).send(error));
                    });
                  }
                })
                .catch((error) => res.status(404).send(error));
            });
          }
        })
        .catch((error) => res.status(404).send(error));
    });

    res.status(200).send(true);
  };

  const moveTask = (req, res) => {
    if (!req.body.fromNum || !req.body.toNum) {
      res.status(400).send({ error: 'wbsId, fromNum, toNum are mandatory fields' });
      return;
    }

    Task.find({ wbsId: { $in: req.params.wbsId } }).then((tasks) => {
      const fromNumArr = req.body.fromNum.replace(/\.0/g, '').split('.');
      const toNumArr = req.body.toNum.replace(/\.0/g, '').split('.');

      const changedLvl = fromNumArr.length;

      const fromLastLvl = parseInt(fromNumArr.pop(), 10);
      const toLastLvl = parseInt(toNumArr.pop(), 10);

      const leadingLvls = fromNumArr.length ? fromNumArr.join('.').concat('.') : '';

      const changingNums = [];
      for (
        let i = Math.min(fromLastLvl, toLastLvl);
        i <= Math.max(fromLastLvl, toLastLvl);
        i += 1
      ) {
        changingNums.push(leadingLvls.concat(`${i}`));
      }
      const changingNumTasks = tasks.filter((task) => {
        const taskLeadingNum = task.num.split('.').slice(0, changedLvl).join('.');
        return changingNums.includes(taskLeadingNum);
      });

      const queries = [];

      changingNumTasks.forEach((task) => {
        const taskNumArr = task.num.split('.');
        const taskChanedLvlNum = parseInt(taskNumArr[changedLvl - 1], 10);
        let newTaskLastLvl;
        if (fromLastLvl > toLastLvl) {
          newTaskLastLvl = taskChanedLvlNum === fromLastLvl ? toLastLvl : taskChanedLvlNum + 1;
        } else {
          newTaskLastLvl = taskChanedLvlNum === fromLastLvl ? toLastLvl : taskChanedLvlNum - 1;
        }
        taskNumArr[changedLvl - 1] = String(newTaskLastLvl);
        task.num = taskNumArr.join('.');
        queries.push(task.save());
      });

      Promise.all(queries)
        .then(() => res.status(200).send('Success!'))
        .catch((err) => res.status(400).send(err));
    });
  };

  const deleteTask = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'deleteTask'))) {
      res.status(403).send({ error: 'You are not authorized to deleteTasks.' });
      return;
    }

    const { taskId } = req.params;
    const { mother } = req.params;

    const removeChildTasks = Task.find({
      $or: [{ _id: taskId }, { parentId1: taskId }, { parentId2: taskId }, { parentId3: taskId }],
    }).then((record) => {
      if (!record || record === null || record.length === 0)
        return res.status(400).send({ error: 'No valid records found' });
      const removeTasks = record.map((rec) => rec.remove());
      return removeTasks;
    });

    const updateMotherChildrenQty =
      mother !== 'null'
        ? Task.findById(mother).then((task) => {
            let newQty = 0;
            let child = true;
            if (task.childrenQty > 0) {
              newQty = task.childrenQty - 1;
              if (newQty === 0) {
                child = false;
              }
            }
            task.hasChild = child;
            task.childrenQty = newQty;
            return task.save();
          })
        : Promise.resolve(1);

    // delete followUp for deleted task
    await followUp.findOneAndDelete({ taskId });

    Promise.all([removeChildTasks, updateMotherChildrenQty])
      .then(() => res.status(200).send({ message: 'Task successfully deleted' }))
      .catch((errors) => res.status(400).send(errors));
  };

  const deleteTaskByWBS = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'deleteTask'))) {
      res.status(403).send({ error: 'You are not authorized to deleteTasks.' });
      return;
    }

    const { wbsId } = req.params;

    Task.find({ wbsId: { $in: [wbsId] } }, (error, record) => {
      if (error || !record || record === null || record.length === 0) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }

      const removeTasks = [];
      record.forEach((rec) => {
        removeTasks.push(rec.remove());
      });

      const deleteFollowUps = record.map((rec) => followUp.findOneAndDelete({ taskId: rec._id }));

      Promise.all([...removeTasks, ...deleteFollowUps])
        .then(() => res.status(200).send({ message: ' Tasks were successfully deleted' }))
        .catch((errors) => {
          res.status(400).send(errors);
        });
    }).catch((errors) => {
      res.status(400).send(errors);
    });
  };

  const updateTask = async (req, res) => {
    if (
      !(await hasPermission(req.body.requestor, 'updateTask')) &&
      !(await hasPermission(req.body.requestor, 'removeUserFromTask'))
    ) {
      res.status(403).send({ error: 'You are not authorized to update Task.' });
      return;
    }

    if (
      req.body.hoursBest < 0 &&
      req.body.hoursWorst < 0 &&
      req.body.hoursMost < 0 &&
      req.body.hoursLogged < 0 &&
      req.body.estimatedHours < 0
    ) {
      return res.status(400).send({
        error:
          'Hours Best, Hours Worst, Hours Most, Hours Logged and Estimated Hours should be greater than 0',
      });
    }

    const { taskId } = req.params;

    // Get current task state before update for change logging (with error handling)
    let oldTask = null;
    try {
      oldTask = await Task.findById(taskId);
    } catch (findError) {
      console.error('Error finding task:', findError);
      return res.status(404).send({ error: 'No valid records found' });
    }

    // Get user information for change logging - with timeout protection
    let user = null;
    try {
      if (req.body.requestor && req.body.requestor.requestorId) {
        user = await UserProfile.findById(req.body.requestor.requestorId).maxTimeMS(5000);
      }
    } catch (userError) {
      console.warn('Warning: Could not fetch user for change tracking:', userError.message);
    }

    // Updating a task will update the modifiedDateandTime of project and wbs
    Task.findById(taskId).then((currentTask) => {
      WBS.findById(currentTask.wbsId).then((currentwbs) => {
        currentwbs.modifiedDatetime = Date.now();
        return currentwbs.save();
      });
    });

    try {
      // IF CATEGORY IS BEING UPDATED, UPDATE BOTH FLAGS
      if (req.body.category !== undefined) {
        logger.logInfo(
          `[Category Update] Task ${taskId} category being updated to: "${req.body.category}"`,
        );

        // Get the task's project category
        const currentTask = await Task.findById(taskId);
        if (currentTask) {
          logger.logInfo(`[Category Update] Found task: ${currentTask.taskName}`);

          const currentWBS = await WBS.findById(currentTask.wbsId);
          if (currentWBS) {
            logger.logInfo(`[Category Update] Found WBS: ${currentWBS.wbsName}`);

            const currentProject = await Project.findById(currentWBS.projectId);
            if (currentProject) {
              logger.logInfo(
                `[Category Update] Found project: ${currentProject.projectName}, project category: "${currentProject.category}"`,
              );

              // Check if new category is different from project category
              if (req.body.category !== currentProject.category) {
                // User is manually setting a different category
                req.body.categoryOverride = true;
                req.body.categoryLocked = true; // Lock it since user is explicitly choosing different category
                logger.logInfo(
                  `[Category Update] Task category "${req.body.category}" differs from project category "${currentProject.category}" - setting override=TRUE, locked=TRUE`,
                );
              } else {
                // User is setting it to match project category
                req.body.categoryOverride = false;
                req.body.categoryLocked = false; // Unlock it so it can cascade with future project changes
                logger.logInfo(
                  `[Category Update] Task category "${req.body.category}" matches project category "${currentProject.category}" - setting override=FALSE, locked=FALSE`,
                );
              }
            } else {
              logger.warn(`[Category Update] Project not found for WBS ${currentWBS._id}`);
            }
          } else {
            logger.warn(`[Category Update] WBS not found for task ${taskId}`);
          }
        } else {
          logger.warn(`[Category Update] Task ${taskId} not found`);
        }
      }

      // Updating a task will update the modifiedDateandTime of project and wbs - Sucheta
      Task.findById(taskId).then((currentTask) => {
        WBS.findById(currentTask.wbsId).then((currentwbs) => {
          currentwbs.modifiedDatetime = Date.now();
          return currentwbs.save();
        });
      });

    // Prevent changing createdBy via updates
    if ('createdBy' in req.body) {
      delete req.body.createdBy;
    }

    Task.findOneAndUpdate(
      { _id: taskId },
      { ...req.body, modifiedDatetime: Date.now() },
      { new: true, runValidators: true },
    )
      .then(async (updatedTask) => {
        try {
          if (
            oldTask &&
            user &&
            typeof TaskChangeTracker !== 'undefined' &&
            TaskChangeTracker.logChanges
          ) {
            await TaskChangeTracker.logChanges(
              taskId,
              oldTask.toObject(),
              updatedTask.toObject(),
              user,
              req,
            );
          }
        } catch (logError) {
          console.warn('Warning: Could not log task changes:', logError.message);
        }
      } catch (logError) {
        console.warn('Warning: Could not log task changes:', logError.message);
        // Continue without logging - don't fail the update
      }

      res.status(201).send(updatedTask);
    } catch (error) {
      // Check if it's a specific error that should return 404
      if (error && error.error === 'No valid records found') {
        return res.status(404).send(error);
      }

      logger.logException(error);
      res.status(500).send({ error: error.message });
    }
  };

  const swap = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'swapTask'))) {
      res.status(403).send({ error: 'You are not authorized to create new projects.' });
      return;
    }

    if (!req.body.taskId1 || !req.body.taskId2) {
      res.status(400).send({ error: 'taskId1 and taskId2 are mandatory fields' });
      return;
    }

    Task.findById(req.body.taskId1, (error1, task1) => {
      if (error1 || task1 === null) {
        res.status(400).send('No valid records found');
        return;
      }

      Task.findById(req.body.taskId2, (error2, task2) => {
        if (error2 || task2 === null) {
          res.status(400).send('No valid records found');
          return;
        }

        if (task1.parentId.toString() === task2.parentId.toString()) {
          let tmpNum = '';
          tmpNum = task1.num;
          task1.num = task2.num;
          task2.num = tmpNum;
        } else {
          let tmpName = '';
          tmpName = task1.taskName;
          task1.taskName = task2.taskName;
          task2.taskName = tmpName;
        }

        task1
          .save()
          .then()
          .catch((errors) => res.status(400).send(errors));

        task2
          .save()
          .then()
          .catch((errors) => res.status(400).send(errors));

        Task.find({
          wbsId: { $in: [task1.wbsId] },
        })
          .then((results) => res.status(200).send(results))
          .catch((error) => res.status(404).send(error));
      });
    });
  };

  const getTaskById = async (req, res) => {
    try {
      const taskId = req.params.id;

      if (!taskId || taskId === 'undefined') {
        return res.status(400).send({ error: 'Task ID is missing' });
      }

      const taskDoc = await Task.findById(taskId, '-__v  -createdDatetime -modifiedDatetime')
        .populate('createdBy', 'firstName lastName email') // <-- added
        .lean();

      if (!taskDoc) {
        return res.status(400).send({ error: 'This is not a valid task' });
      }

      const task = {
        ...taskDoc,
        creatorName: taskDoc.createdBy
          ? [taskDoc.createdBy.firstName, taskDoc.createdBy.lastName]
              .filter(Boolean)
              .join(' ')
              .trim()
          : undefined,
      };

      const resourceNamesPromises = (task.resources || []).map((resource) =>
        taskHelper.getUserProfileFirstAndLastName(resource.userID),
      );
      const resourceNames = await Promise.all(resourceNamesPromises);

      (task.resources || []).forEach((resource, index) => {
        resource.name = resourceNames[index] !== ' ' ? resourceNames[index] : resource.name;
      });

      return res.status(200).send(task);
    } catch (error) {
      return res.status(500).send({ error: 'Internal Server Error', details: error.message });
    }
  };

  const updateAllParents = (req, res) => {
    const { wbsId } = req.params;

    try {
      Task.find({ wbsId: { $in: [wbsId] } }).then((tasks) => {
        tasks = tasks.filter((task) => task.level === 1);
        tasks.forEach((task) => {
          updateParents(task.wbsId, task.taskId.toString());
        });
        res.status(200).send('done');
      });
      res.status(200).send('done');
    } catch (error) {
      res.status(400).send(error);
    }
  };

  const fixTasks = function (req, res) {
    res.status(200).send('done');
  };

  const getTasksByUserId = async (req, res) => {
    const { userId } = req.params;
    try {
      // 1) Run your existing aggregation (no creator $lookup here)
      const tasks = await Task.aggregate()
        .match({
          resources: {
            $elemMatch: {
              userID: mongoose.Types.ObjectId(userId),
              completedTask: { $ne: true },
            },
          },
          isActive: { $ne: false },
        })
        .lookup({
          from: 'wbs',
          localField: 'wbsId',
          foreignField: '_id',
          as: 'wbs',
        })
        .unwind({
          path: '$wbs',
          includeArrayIndex: 'string',
          preserveNullAndEmptyArrays: true,
        })
        .addFields({
          wbsName: '$wbs.wbsName',
          projectId: '$wbs.projectId',
        })
        .lookup({
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project',
        })
        .unwind({
          path: '$project',
          includeArrayIndex: 'string',
          preserveNullAndEmptyArrays: true,
        })
        .addFields({
          projectName: '$project.projectName',
        })
        .project({ wbs: 0, project: 0 })
        .allowDiskUse(true);

      // 2) Enrich with creatorName safely (no dependency on collection string)
      const creatorIds = [
        ...new Set(
          tasks
            .map((t) => t.createdBy)
            .filter(Boolean)
            .map((id) => id.toString()),
        ),
      ];

      if (creatorIds.length) {
        const profiles = await UserProfile.find(
          { _id: { $in: creatorIds.map((x) => mongoose.Types.ObjectId(x)) } },
          'firstName lastName email',
        ).lean();

        const nameById = new Map(
          profiles.map((u) => [
            u._id.toString(),
            `${(u.firstName || '').trim()} ${(u.lastName || '').trim()}`.trim() || u.email || '',
          ]),
        );

        tasks.forEach((t) => {
          const k = t.createdBy && t.createdBy.toString();
          const name = k && nameById.get(k);
          if (name) t.creatorName = name;
        });
      }

      return res.status(200).send(tasks);
    } catch (error) {
      return res.status(400).send(error);
    }
  };

  // Attach creatorName to each task in an array/tree shape returned by the helpers
  async function attachCreatorNames(items) {
    // Flatten out all tasks we can find (handles both "teamsData" and "singleUserData" shapes)
    const collectTasks = (arr) => {
      const out = [];
      arr.forEach((block) => {
        // common shapes we’ve seen:
        //  - block.tasks: array of tasks
        //  - block: could itself be a task
        if (Array.isArray(block?.tasks)) out.push(...block.tasks);
        else if (block && block.taskName && (block._id || block.id)) out.push(block);
      });
      return out;
    };

    const allTasks = collectTasks(items);
    if (!allTasks.length) return items;

    // Collect distinct createdBy ids (accepts object or id)
    const ids = [
      ...new Set(
        allTasks
          .map((t) => {
            if (t.createdBy && t.createdBy._id) {
              return String(t.createdBy._id);
            }
            if (t.createdBy) {
              return String(t.createdBy);
            }
            return null;
          })
          .filter(Boolean),
      ),
    ];

    if (!ids.length) return items;

    const profiles = await UserProfile.find(
      { _id: { $in: ids } },
      'firstName lastName email',
    ).lean();

    const nameMap = new Map(
      profiles.map((p) => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
        return [String(p._id), name || p.email || 'Unknown'];
      }),
    );

    // Mutate in place: add creatorName and (if useful) a light createdBy object
    allTasks.forEach((t) => {
      let id = null;
      if (t.createdBy && t.createdBy._id) {
        id = String(t.createdBy._id);
      } else if (t.createdBy) {
        id = String(t.createdBy);
      }

      if (id && nameMap.has(id)) {
        t.creatorName = nameMap.get(id);
        // if createdBy was just an id, keep it but also add light object for UI that reads it
        if (
          typeof t.createdBy === 'string' ||
          (typeof t.createdBy === 'object' && !t.createdBy.firstName)
        ) {
          const prof = profiles.find((p) => String(p._id) === id);
          if (prof)
            t.createdBy = {
              _id: prof._id,
              firstName: prof.firstName,
              lastName: prof.lastName,
              email: prof.email,
            };
        }
      }
    });

    return items;
  }

  const getTasksForTeamsByUser = async (req, res) => {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    try {
      const teamsData = await taskHelper.getTasksForTeams(userId, req.body.requestor);

      if (teamsData && teamsData.length > 0) {
        await attachCreatorNames(teamsData);
        return res.status(200).send(teamsData);
      }

      const singleUserData = await taskHelper.getTasksForSingleUser(userId).exec();
      await attachCreatorNames(singleUserData);
      return res.status(200).send(singleUserData);
    } catch (error) {
      console.log(error);
      return res.status(400).send({ error });
    }
  };

  const updateTaskStatus = async (req, res) => {
    const { taskId } = req.params;
    Task.findById(taskId).then((currentTask) => {
      WBS.findById(currentTask.wbsId).then((currentwbs) => {
        currentwbs.modifiedDatetime = Date.now();
        return currentwbs.save();
      });
    });

    Task.findById(taskId).then((currentTask) => {
      WBS.findById(currentTask.wbsId).then((currentwbs) => {
        Project.findById(currentwbs.projectId).then((currentProject) => {
          currentProject.modifiedDatetime = Date.now();
          return currentProject.save();
        });
      });
    });
    Task.findOneAndUpdate({ _id: taskId }, { ...req.body, modifiedDatetime: Date.now() })
      .then(() => res.status(201).send())
      .catch((error) => res.status(404).send(error));
  };

  const getReviewReqEmailBody = function (name, taskName) {
    const text = `New Task Review Request From <b>${name}</b>:
        <p>The following task is available to review:</p>
        <p><b>${taskName}</b></p>
        <p>Thank you,</p>
        <p>One Community</p>`;

    return text;
  };
  const getRecipients = async function (myUserId) {
    const recipients = [];
    const user = await UserProfile.findById(myUserId);
    let membership = [];
    try {
      membership = await UserProfile.find({
        role: { $in: ['Administrator', 'Manager', 'Mentor'] },
        isActive: true,
      }).maxTimeMS(5000);
    } catch (error) {
      console.error('Error fetching membership:', error);
      return [];
    }
    membership
      .filter(
        (member) =>
          Array.isArray(member.teams) &&
          Array.isArray(user.teams) &&
          member.teams.some((team) => user.teams.includes(team)),
      )
      .forEach((member) => recipients.push(member.email));
    return recipients;
  };

  const sendReviewReq = async function (req, res) {
    const { myUserId, name, taskName } = req.body;
    const emailBody = getReviewReqEmailBody(name, taskName);
    try {
      const recipients = await getRecipients(myUserId);
      await emailSender(recipients, `Review Request from ${name}`, emailBody, null, null);
      res.status(200).send('Success');
    } catch (err) {
      console.error('Error in sendReviewReq:', err);
      res.status(500).send('Failed');
    }
  };

  /**
   * Fix category flags for all tasks in a WBS
   * Compares each task's category with the project category
   * and sets both categoryOverride and categoryLocked flags
   *
   * This is for one-time migration/fix only
   */
  const fixTaskOverrides = async (req, res) => {
    try {
      const { wbsId } = req.params;
      logger.logInfo(`[Fix Category Flags] Starting fix for WBS: ${wbsId}`);

      // Get the WBS and project
      const wbsDoc = await WBS.findById(wbsId);
      if (!wbsDoc) {
        return res.status(404).send({ error: 'WBS not found' });
      }

      const project = await Project.findById(wbsDoc.projectId);
      if (!project) {
        return res.status(404).send({ error: 'Project not found' });
      }

      const projectCategory = project.category || 'Unspecified';
      logger.logInfo(`[Fix Category Flags] Project category: "${projectCategory}"`);

      // Get all tasks for this WBS
      const tasks = await Task.find({ wbsId });
      logger.logInfo(`[Fix Category Flags] Found ${tasks.length} tasks to check`);

      let fixedCount = 0;
      const updates = [];

      tasks.forEach((task) => {
        const taskCategory = task.category || 'Unspecified';
        const shouldBeOverride = taskCategory !== projectCategory;
        const shouldBeLocked = taskCategory !== projectCategory;

        const currentOverride = task.categoryOverride || false;
        const currentLocked = task.categoryLocked || false;

        // Only update if either flag needs fixing
        if (shouldBeOverride !== currentOverride || shouldBeLocked !== currentLocked) {
          logger.logInfo(
            `[Fix Category Flags] Fixing task "${task.taskName}": category="${taskCategory}", override=${currentOverride}->${shouldBeOverride}, locked=${currentLocked}->${shouldBeLocked}`,
          );
          updates.push({
            updateOne: {
              filter: { _id: task._id },
              update: {
                $set: {
                  categoryOverride: shouldBeOverride,
                  categoryLocked: shouldBeLocked,
                },
              },
            },
          });
          fixedCount += 1;
        }
      });

      if (updates.length > 0) {
        await Task.bulkWrite(updates);
        logger.logInfo(`[Fix Category Flags] Fixed ${fixedCount} tasks`);
        res.status(200).send({
          message: `Successfully fixed ${fixedCount} task(s)`,
          fixedCount,
          totalTasks: tasks.length,
        });
      } else {
        logger.logInfo(`[Fix Category Flags] No tasks needed fixing`);
        res.status(200).send({
          message: 'All task category flags are already correct',
          fixedCount: 0,
          totalTasks: tasks.length,
        });
      }
    } catch (err) {
      logger.logException(err);
      res.status(500).send({ error: 'Failed to fix task category flags', details: err.message });
    }
  };
  // New endpoint to get change logs for a specific task
  const getTaskChangeLogs = async (req, res) => {
    try {
      const { taskId } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const skip = (page - 1) * limit;

      const changeLogs = await TaskChangeLog.find({ taskId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email profilePic')
        .lean();

      const total = await TaskChangeLog.countDocuments({ taskId });

      res.status(200).json({
        changeLogs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching task change logs:', error);
      res.status(500).json({ error: error.message });
    }
  };

  // New endpoint to get change logs for a user across all tasks
  const getUserTaskChangeLogs = async (req, res) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const skip = (page - 1) * limit;

      const changeLogs = await TaskChangeLog.find({ userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('taskId', 'taskName num')
        .populate('userId', 'firstName lastName email profilePic')
        .lean();

      const total = await TaskChangeLog.countDocuments({ userId });

      res.status(200).json({
        changeLogs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching user task change logs:', error);
      res.status(500).json({ error: error.message });
    }
  };

  return {
    postTask,
    getTasks,
    getWBSId,
    swap,
    updateNum,
    deleteTask,
    getTaskById,
    updateTask,
    importTask,
    fixTasks,
    updateAllParents,
    deleteTaskByWBS,
    moveTask,
    getTasksByUserId,
    getTasksForTeamsByUser,
    updateTaskStatus,
    sendReviewReq,
    fixTaskOverrides,
    getTaskChangeLogs,
    getUserTaskChangeLogs,
  };
};

module.exports = taskController;
