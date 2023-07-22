const mongoose = require('mongoose');
const wbs = require('../models/wbs');
const timeEntryHelper = require('../helpers/timeEntryHelper')();
const taskHelper = require('../helpers/taskHelper')();
const hasPermission = require('../utilities/permissions');

const taskController = function (Task) {
  const getTasks = (req, res) => {
    const { level } = req.params;

    let query = {
      wbsId: { $in: [req.params.wbsId] },
      level: { $in: [level] },
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
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const getWBSId = (req, res) => {
    const { wbsId } = req.params;

    wbs.findById(wbsId)
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
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
    const parentTasks = tasks.filter(task => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter(
        taskChild => taskChild.level === level + 1,
      );
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
          sumHoursWorst = parseFloat(childTask.hoursWorst, 10)
            + parseFloat(sumHoursWorst, 10);
          sumHoursMost = parseFloat(childTask.hoursMost, 10) + parseFloat(sumHoursMost, 10);
          sumHoursLogged = parseFloat(childTask.hoursLogged, 10)
            + parseFloat(sumHoursLogged, 10);
          sumEstimatedHours = parseFloat(childTask.estimatedHours, 10)
            + parseFloat(sumEstimatedHours, 10);
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
    const parentTasks = tasks.filter(task => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter(
        taskChild => taskChild.level === level + 1,
      );
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
    const parentTasks = tasks.filter(task => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter(
        taskChild => taskChild.level === level + 1,
      );
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
    const parentTasks = tasks.filter(task => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter(
        taskChild => taskChild.level === level + 1,
      );
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
      ],
    }).then((tasks) => {
      tasks = [...new Set(tasks.map(item => item))];
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
    /**
     * Based on frontend,  5 props are missing from the task modal:
     *    hasChild,
     *    childrenQty,
     *    createdDatetime,
     *    modifiedDatetime,
     *    classification.  // not sure what this classification is for
     * task._id will also be assigned for better referencing
     */

    // adds _id prop to task, and converts resources to correct format
    const tasksWithId = tasks.map((task) => {
      const _id = new mongoose.Types.ObjectId();
      const resources = task.resources.map((resource) => {
        const [name, userID, profilePic] = resource.split('|');
        return { name, userID, profilePic };
      });

      return {
        ...task, _id, resources,
      };
    });

    // update tasks makes sure its parentIds and mother props are correct assigned,
    tasksWithId.forEach((task) => {
      const taskNumArr = task.num.split('.');
      switch (task.level) {
        case 1: // task.num is x, no parentId1 or mother
          task.parentId1 = null; // no parent so its value is null
          task.parentId2 = null;
          task.parentId3 = null;
          task.mother = null;
          break;
        case 2: // task.num is x.x, only has one level of parent (x)
          task.parentId1 = tasksWithId.find(pTask => pTask.num === taskNumArr[0])._id; // task of parentId1 has num prop of x
          task.parentId2 = null;
          task.parentId3 = null;
          task.mother = task.parentId1; // parent task num prop is x
          break;
        case 3: // task.num is x.x.x, has two levels of parent (parent: x.x and grandparent: x)
          task.parentId1 = tasksWithId.find(pTask => pTask.num === taskNumArr[0])._id; // task of parentId1 has num prop of x
          task.parentId2 = tasksWithId.find(pTask => pTask.num === `${taskNumArr[0]}.${taskNumArr[1]}`)._id; // task of parentId2 has num prop of x.x
          task.parentId3 = null;
          task.mother = task.parentId2; // parent task num prop is x.x
          break;
        case 4: // task.num is x.x.x.x, has three levels of parent (x.x.x, x.x and x)
          task.parentId1 = tasksWithId.find(pTask => pTask.num === taskNumArr[0])._id; // x
          task.parentId2 = tasksWithId.find(pTask => pTask.num === `${taskNumArr[0]}.${taskNumArr[1]}`)._id; // x.x
          task.parentId3 = tasksWithId.find(pTask => pTask.num === `${taskNumArr[0]}.${taskNumArr[1]}.${taskNumArr[2]}`)._id; // x.x.x
          task.mother = task.parentId3; // parent task num prop is x.x.x
          break;
        default:
      }
    });

    // create an array of four empty arrays
    const tasksFromSameLevelArr = Array(4).fill(null).map(() => []);

    // sort them out into an array of four arrays based on their levels
    tasksWithId.forEach((task) => {
      tasksFromSameLevelArr[task.level - 1].push(task);
    });

    // reverse taskArr so that order is level 4, 3, 2, 1 tasks at index of 0, 1, 2, 3;
    // then add hasChild, childrenQty props to task, and sum lower level tasks data to higher level tasks;
    tasksFromSameLevelArr.reverse().forEach((tasksFromSameLevel, i) => {
      if (i === 0) {
        // level 4 tasks (lowest level) has no child task
        tasksFromSameLevel.forEach((task) => {
          task.hasChild = false;
          task.childrenQty = 0;
        });
      } else {
        // level 3 to 1 tasks updates their props based on child from lower level tasks, process order from 3 to 1 ensures thorough data gathering
        tasksFromSameLevel.forEach((task) => {
          // keep track of the priority points based on child task priority and the total number of child tasks
          let priorityPts = 0;
          // iterate through lower level tasks
          tasksFromSameLevelArr[i - 1].forEach((childTask) => {
            if (childTask.mother === task._id) {
              // update related props
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
              task.resources = childTask.resources.reduce((resources, childTaskMember) => {
                if (task.resources.every(member => member.name !== childTaskMember.name)) return [...resources, childTaskMember];
                return resources;
              }, [...task.resources]);
              // add priority pts for task.priority
              if (childTask.priority === 'Primary') {
                priorityPts += 3;
              } else if (childTask.priority === 'Secondary') {
                priorityPts += 2;
              } else {
                priorityPts += 1;
              }
              // add num of children
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

  const importTask = (req, res) => {
    if (!hasPermission(req.body.requestor.role, 'importTask')) {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    const wbsId = req.params.id;
    const taskList = req.body.list;
    const fixedTasks = fixTasksLocal(taskList);

    fixedTasks.forEach((task) => {
      const createdDatetime = Date.now();
      const modifiedDatetime = Date.now();
      const _task = new Task({
        ...task, wbsId, createdDatetime, modifiedDatetime,
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

  const postTask = (req, res) => {
    if (!hasPermission(req.body.requestor.role, 'postTask')) {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    if (!req.body.taskName || !req.body.isActive) {
      res.status(400).send({
        error: 'Task Name, Active status, Task Number are mandatory fields',
      });
      return;
    }

    const wbsId = req.params.id;
    const task = req.body;
    const createdDatetime = Date.now();
    const modifiedDatetime = Date.now();

    const _task = new Task({
      ...task, wbsId, createdDatetime, modifiedDatetime,
    });

    const saveTask = _task.save();
    const saveWbs = wbs.findById(wbsId).then((currentwbs) => {
      currentwbs.modifiedDatetime = Date.now();
      return currentwbs.save();
    });

    Promise.all([saveTask, saveWbs]).then(results => res.status(201).send(results[0]))
      .catch((errors) => {
        res.status(400).send(errors);
      });
  };

  const updateNum = (req, res) => {
    if (!hasPermission(req.body.requestor.role, 'updateNum')) {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new projects.' });
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
          .catch(errors => res.status(400).send(errors));
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
                .catch(errors => res.status(400).send(errors));

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
                        .catch(errors => res.status(400).send(errors));

                      // level 4
                      Task.find({ parentId: { $in: [childTask2._id] } })
                        .then((childTasks3) => {
                          if (childTasks3.length > 0) {
                            childTasks3.forEach((childTask3) => {
                              childTask3.num = childTask3.num.replace(
                                childTask3.num.substring(
                                  0,
                                  childTask2.num.length,
                                ),
                                childTask2.num,
                              );

                              childTask3
                                .save()
                                .then(true)
                                .catch(errors => res.status(400).send(errors));
                            });
                          }
                        })
                        .catch(error => res.status(404).send(error));
                    });
                  }
                })
                .catch(error => res.status(404).send(error));
            });
          }
        })
        .catch(error => res.status(404).send(error));
    });

    res.status(200).send(true);
  };

  const moveTask = (req, res) => {
    if (!req.body.fromNum || !req.body.toNum) {
      res
        .status(400)
        .send({ error: 'wbsId, fromNum, toNum are mandatory fields' });
      return;
    }

    Task.find({ wbsId: { $in: req.params.wbsId } }).then((tasks) => {
      const fromNumArr = req.body.fromNum.replace(/\.0/g, '').split('.');
      const toNumArr = req.body.toNum.replace(/\.0/g, '').split('.');

      const fromLastLvl = parseInt(fromNumArr.pop(), 10);
      const toLastLvl = parseInt(toNumArr.pop(), 10);

      const leadingLvls = fromNumArr.length ? fromNumArr.join('.').concat('.') : ''; // in a format of x, x.x, or x.x.x, also could be '' if move level one tasks

      const changingNums = [];
      for (let i = Math.min(fromLastLvl, toLastLvl); i <= Math.max(fromLastLvl, toLastLvl); i += 1) {
        changingNums.push(leadingLvls.concat(`${i}`));
      }
      const changingNumTasks = tasks.filter(task => changingNums.includes(task.num));

      const queries = [];

      changingNumTasks.forEach((task) => {
        const taskNumArr = task.num.split('.');
        const taskLastLvl = parseInt(taskNumArr.pop(), 10);
        let newTaskLastLvl;
        if (fromLastLvl > toLastLvl) {
          newTaskLastLvl = taskLastLvl === fromLastLvl ? toLastLvl : taskLastLvl + 1;
        } else {
          newTaskLastLvl = taskLastLvl === fromLastLvl ? toLastLvl : taskLastLvl - 1;
        }
        taskNumArr.push(String(newTaskLastLvl));
        task.num = taskNumArr.join('.');
        queries.push(task.save());
      });

      Promise.all(queries)
      .then(() => res.status(200).send('Success!'))
      .catch(err => res.status(400).send(err));
    });
  };

  const deleteTask = (req, res) => {
    const { taskId } = req.params;
    const { mother } = req.params;

    const removeChildTasks = Task.find(
      {
        $or: [
          { _id: taskId },
          { parentId1: taskId },
          { parentId2: taskId },
          { parentId3: taskId },
        ],
      },
    )
    .then((record) => {
        if (!record || record === null || record.length === 0) return res.status(400).send({ error: 'No valid records found' });
        const removeTasks = record.map(rec => rec.remove());
        return removeTasks;
    });

    const updateMotherChildrenQty = mother !== 'null'
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

    Promise
    .all([removeChildTasks, updateMotherChildrenQty])
    .then(() => res.status(200).send({ message: 'Task successfully deleted' })) // no need to resetNum(taskId, mother);
    .catch(errors => res.status(400).send(errors));
  };

  const deleteTaskByWBS = (req, res) => {
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

      Promise.all([...removeTasks])
        .then(() => res.status(200).send({ message: ' Tasks were successfully deleted' }))
        .catch((errors) => {
          res.status(400).send(errors);
        });
    }).catch((errors) => {
      res.status(400).send(errors);
    });
  };

  const updateTask = (req, res) => {
    if (!hasPermission(req.body.requestor.role, 'updateTask')) {
      res.status(403).send({ error: 'You are not authorized to update Task.' });
      return;
    }

    const { taskId } = req.params;

    Task.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(taskId) },
      { ...req.body, modifiedDatetime: Date.now() },
    )
      .then(() => res.status(201).send())
      .catch(error => res.status(404).send(error));
  };

  const swap = function (req, res) {
    if (!hasPermission(req.body.requestor.role, 'swapTask')) {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new projects.' });
      return;
    }

    if (!req.body.taskId1 || !req.body.taskId2) {
      res
        .status(400)
        .send({ error: 'taskId1 and taskId2 are mandatory fields' });
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
          .catch(errors => res.status(400).send(errors));

        task2
          .save()
          .then()
          .catch(errors => res.status(400).send(errors));

        Task.find({
          wbsId: { $in: [task1.wbsId] },
        })
          .then(results => res.status(200).send(results))
          .catch(error => res.status(404).send(error));
      });
    });
  };

  const getTaskById = function (req, res) {
    const taskId = req.params.id;
    Task.findById(taskId, '-__v  -createdDatetime -modifiedDatetime')
      .then((results) => {
        if (!results) {
          res.status(400).send({ error: 'This is not a valid task' });
          return;
        }
        timeEntryHelper
          .getAllHoursLoggedForSpecifiedProject(taskId)
          .then((hours) => {
            results.set('hoursLogged', hours, { strict: false });
            res.status(200).send(results);
          });
      })
      .catch(error => res.status(404).send(error));
  };

  const updateAllParents = (req, res) => {
    const { wbsId } = req.params;

    try {
      Task.find({ wbsId: { $in: [wbsId] } }).then((tasks) => {
        tasks = tasks.filter(task => task.level === 1);
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

  const getTasksByUserList = async (req, res) => {
    const { members } = req.query;
    const membersArr = members.split(',');
    try {
      Task.find(
        { 'resources.userID': { $in: membersArr } },
        '-resources.profilePic',
      ).then((results) => {
        wbs
          .find({
            _id: { $in: results.map(item => item.wbsId) },
          })
          .then((projectIds) => {
            const resultsWithProjectsIds = results.map((item) => {
              item.set(
                'projectId',
                projectIds?.find(
                  projectId => projectId._id.toString() === item.wbsId.toString(),
                )?.projectId,
                { strict: false },
              );
              return item;
            });
            res.status(200).send(resultsWithProjectsIds);
          });
      });
    } catch (error) {
      res.status(400).send(error);
    }
  };

  const getTasksForTeamsByUser = async (req, res) => {
    try {
      const userId = mongoose.Types.ObjectId(req.params.userId);
      const teamsData = await taskHelper.getTasksForTeams(userId).exec();
      if (teamsData.length > 0) {
        res.status(200).send(teamsData);
      } else {
        const singleUserData = await taskHelper.getTasksForSingleUser(userId).exec();
        res.status(200).send(singleUserData);
      }
    } catch (error) {
      res.status(400).send(error);
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
    getTasksByUserList,
    getTasksForTeamsByUser,
  };
};

module.exports = taskController;
