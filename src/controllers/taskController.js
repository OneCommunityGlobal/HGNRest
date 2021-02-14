const mongoose = require('mongoose');

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


  const updateSumUp = (taskId, hoursBest, hoursWorst, hoursMost, estimatedHours, resources) => {
    Task.findById(taskId, (error, task) => {
      task.hoursBest = hoursBest;
      task.hoursMost = hoursMost;
      task.hoursWorst = hoursWorst;
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
            tasks[i].estimatedHours = sumEstimatedHours;
            tasks[i].resources = resources;
          }
        });
        updateSumUp(
          task._id,
          sumHoursBest,
          sumHoursWorst,
          sumHoursMost,
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
      $and: [{ $or: [{ taskId: parentId1 }, { parentId1 }, { parentId1: null }] },
        { wbsId: { $in: [wbsId] } }],
    })
      .then((tasks) => {
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

  const updateTaskNums = (taskId, num) => {
    Task.findById(taskId, (error, task) => {
      task.num = num.replace(/.0/g, '');
      task.save();
    });
  };

  const filterAndSort = (tasks, level) => {
    const sortedTask = tasks.sort((a, b) => {
      const aArr = a.num.split('.');
      const bArr = b.num.split('.');
      for (let i = 0; i < level; i += 1) {
        if (parseInt(aArr[i], 10) < parseInt(bArr[i], 10)) {
          return -1;
        }
        if (parseInt(aArr[i], 10) > parseInt(bArr[i], 10)) {
          return 1;
        }
      }
      return 1;
    });
    return sortedTask;
  };

  const sortByNum = (tasks) => {
    const appendTasks = [];

    tasks.forEach((task) => {
      const numChildren = tasks.filter(item => item.mother === task.taskId).length;
      if (numChildren > 0) {
        task.hasChildren = true;
      } else {
        task.hasChildren = false;
      }
      if (task.level === 1) {
        task.num += '.0.0.0';
      }
      if (task.level === 2) {
        task.num += '.0.0';
      }
      if (task.level === 3) {
        task.num += '.0';
      }

      appendTasks.push(task);
    });

    return filterAndSort(appendTasks, 4);
  };

  const resetNum = (deletedTask, mother) => {
    Task.findById(mother, (error, motherTask) => {
      const motherNum = motherTask ? motherTask.num : '.';

      Task.find({ mother: { $in: [mother] } }).then((tasks) => {
        const sortedTasks = sortByNum(tasks);
        // const willBeUpdatedNum = [];

        sortedTasks.forEach((task, index) => {
          const newNum = `${motherNum}.${(index + 1)}`.replace('..', '');
          // console.log(task.num.indexOf(newNum));
          if (task.num.indexOf(newNum) !== 0) {
            updateTaskNums(task._id, newNum);
            Task.find(
              {
                $or: [
                  { parentId1: task._id },
                  { parentId2: task._id },
                  { parentId3: task._id },
                ],
              },
              (err, taskChild) => {
                const sortedChildTasks = sortByNum(taskChild);
                sortedChildTasks.forEach((item) => {
                  const childTaskNumArr = item.num.split('.');
                  const newNumArr = newNum.split('.');
                  newNumArr.forEach((numLevel, index2) => {
                    childTaskNumArr[index2] = numLevel;
                  });
                  // console.log(item.num, '->', childTaskNumArr.join('.'));
                  updateTaskNums(item._id, childTaskNumArr.join('.'));
                });
              },
            );
          }
        });
      });
    });
  };


  /*
  const fixedText = (text) => {
    let fixedTextStr = text.replace(/""/g, '"');
    fixedTextStr = fixedTextStr.replace(/;/g, ',');
    if (text[0] === '"') {
      fixedTextStr = fixedTextStr.substring(1, fixedTextStr.length - 1);
    }
    return fixedTextStr;
  }; */


  const calculateSubTasksLocal = (level, tasks) => {
    const calculatedTasks = [];
    const parentTasks = tasks.filter(task => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter(taskChild => taskChild.level === (level + 1));

      let sumHoursBest = 0;
      let sumHoursWorst = 0;
      let sumHoursMost = 0;
      let sumEstimatedHours = 0;
      let minStartedDate = task.startedDatetime;
      let maxDueDatetime = task.dueDatetime;
      let totalNumberPriority = 0;
      let isAssigned = false;

      const resources = [];
      let hasChild = false;
      let totalChild = 0;

      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task._id)) {
          hasChild = true;
          sumHoursBest = parseFloat(childTask.hoursBest, 10) + parseFloat(sumHoursBest, 10);
          sumHoursWorst = parseFloat(childTask.hoursWorst, 10) + parseFloat(sumHoursWorst, 10);
          sumHoursMost = parseFloat(childTask.hoursMost, 10) + parseFloat(sumHoursMost, 10);
          sumEstimatedHours = parseFloat(childTask.estimatedHours, 10) + parseFloat(sumEstimatedHours, 10);
          if (minStartedDate > childTask.startedDatetime) {
            minStartedDate = childTask.startedDatetime;
          }
          if (maxDueDatetime < childTask.dueDatetime) {
            maxDueDatetime = childTask.dueDatetime;
          }

          totalChild += 1;
          if (childTask.priority === 'Primary') {
            totalNumberPriority += 3;
          } else if (childTask.priority === 'Secondary') {
            totalNumberPriority += 2;
          } else if (childTask.priority === 'Tertiary') {
            totalNumberPriority += 1;
          }

          if (childTask.isAssigned) {
            isAssigned = true;
          }


          childTask.resources.forEach((member) => {
            let isInResource = false;
            resources.forEach((mem) => {
              // if (member.userID.equals(mem.userID)) {
              // isInResource = true;
              // }
              if (member.name === mem.name) {
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
            tasks[i].estimatedHours = sumEstimatedHours;
            tasks[i].startedDatetime = minStartedDate;
            tasks[i].dueDatetime = maxDueDatetime;
            tasks[i].hasChild = true;
            tasks[i].isAssigned = isAssigned;

            const avg = totalNumberPriority / totalChild;
            let priority = '';
            if (avg <= 1.6) {
              priority = 'Tertiary';
            } else if (avg > 1.6 && avg < 2.5) {
              priority = 'Secondary';
            } else {
              priority = 'Primary';
            }

            tasks[i].priority = priority;
            tasks[i].resources = resources;
          }
        });
        // updateSumUp(task._id, sumHoursBest, sumHoursWorst, sumHoursMost, sumEstimatedHours, resources);
      }
      calculatedTasks.push(task);
    });
    return calculatedTasks;
  };

  const replaceDotZero = num => num.replace('.0', '').replace('.0', '').replace('.0', '');


  const fixTasksLocal = (tasks, wbsId) => {
    // Format num
    const formatedTasks = [];

    tasks.forEach((task) => {
      if (parseInt(task.level, 10) === 1) {
        task.num += '.0.0.0';
      } else if (parseInt(task.level, 10) === 2) {
        task.num += '.0.0';
      } else if (parseInt(task.level, 10) === 3) {
        task.num += '.0';
      }


      task._id = new mongoose.Types.ObjectId(); // add Id
      task.level = parseInt(task.level, 10); // fix level to number
      task.hoursBest = parseFloat(task.hoursBest.trim(), 10);
      task.hoursWorst = parseFloat(task.hoursWorst.trim(), 10);
      task.hoursMost = parseFloat(task.hoursMost.trim(), 10);
      task.estimatedHours = parseFloat(task.estimatedHours, 10);
      task.estimatedHours = parseFloat(task.estimatedHours, 10);


      if (task.resourceName) {
        task.resources = [{ name: task.resourceName.split('|')[0], userID: task.resourceName.split('|')[1], profilePic: task.resourceName.split('|')[2] }];
      } else {
        task.resources = [];
      }
      formatedTasks.push(task);
    });

    // console.log(formatedTasks);

    // Sort the task
    const sortedTasks = formatedTasks.sort((a, b) => {
      const aArr = a.num.split('.');
      const bArr = b.num.split('.');
      for (let i = 0; i < 4; i += 1) {
        if (parseFloat(aArr[i]) < parseFloat(bArr[i])) {
          return -1;
        }
        if (parseFloat(aArr[i]) > parseFloat(bArr[i])) {
          return 1;
        }
      }
      return 0;
    });


    let parentId1 = null;
    let parentId2 = null;
    let parentId3 = null;

    const updatedParentTasks = [];


    // Create relationship
    sortedTasks.forEach((task) => {
      task.num = replaceDotZero(task.num);
      const taskNumArr = task.num.split('.');
      if (task.level === 1) {
        parentId1 = task._id; // for task level 2
        task.mother = mongoose.Types.ObjectId(wbsId);
      } else if (task.level === 2) {
        parentId1 = tasks.filter(pTask => `${taskNumArr[0]}` === replaceDotZero(pTask.num))[0]._id;
        task.parentId1 = parentId1;
        task.mother = parentId1;
      } else if (task.level === 3) {
        parentId1 = tasks.filter(pTask => taskNumArr[0] === replaceDotZero(pTask.num))[0]._id;
        parentId2 = tasks.filter(pTask => `${taskNumArr[0]}.${taskNumArr[1]}` === replaceDotZero(pTask.num))[0]._id;
        task.parentId1 = parentId1;
        task.parentId2 = parentId2;
        task.mother = parentId2;
      } else if (task.level === 4) {
        parentId1 = tasks.filter(pTask => taskNumArr[0] === pTask.num)[0]._id;
        parentId2 = tasks.filter(pTask => `${taskNumArr[0]}.${taskNumArr[1]}` === replaceDotZero(pTask.num))[0]._id;
        parentId3 = tasks.filter(pTask => `${taskNumArr[0]}.${taskNumArr[1]}.${taskNumArr[2]}` === replaceDotZero(pTask.num))[0]._id;
        task.parentId1 = parentId1;
        task.parentId2 = parentId2;
        task.parentId3 = parentId3;
        task.mother = parentId3;
      }
      updatedParentTasks.push(task);
    });


    // Calculate parents
    const calculatedTasks = [];
    for (let lv = 3; lv > 0; lv -= 1) {
      calculateSubTasksLocal(lv, updatedParentTasks).forEach((task) => {
        calculatedTasks.push(task);
      });
    }

    // we do not calc task level 4, but dont miss it.
    updatedParentTasks.forEach((task) => {
      if (task.level === 4) {
        calculatedTasks.push(task);
      }
    });


    return calculatedTasks;
  };

  const importTask = (req, res) => {
    if (req.body.requestor.role !== 'Administrator') {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    /* if (!req.body.taskName || !req.body.isActive
    ) {
      res.status(400).send({ error: 'Task Name, Active status, Task Number are mandatory fields' });
      return;
    } */

    const wbsId = req.params.id;
    const taskList = req.body.list;
    // console.log('taskList', taskList.length);
    const fixedTasks = fixTasksLocal(taskList, wbsId);
    // const isFine = true;

    // const dbTasks = [];
    // console.log('fixedtask', fixedTasks.length);

    fixedTasks.forEach((task) => {
      const _task = new Task();
      _task._id = task._id;
      _task.wbsId = new mongoose.Types.ObjectId(wbsId);
      _task.taskName = task.taskName;
      _task.num = task.num;
      _task.level = task.level;
      _task.priority = task.priority;
      _task.resources = task.resources;
      _task.isAssigned = task.isAssigned;
      _task.status = task.status;
      _task.hoursBest = task.hoursBest;
      _task.hoursWorst = task.hoursWorst;
      _task.hoursMost = task.hoursMost;
      _task.estimatedHours = parseFloat(task.estimatedHours, 10);
      _task.startedDatetime = task.startedDatetime || null;
      _task.dueDatetime = task.dueDatetime || null;
      _task.links = task.links;
      _task.parentId1 = new mongoose.Types.ObjectId(task.parentId1);
      _task.parentId2 = new mongoose.Types.ObjectId(task.parentId2);
      _task.parentId3 = new mongoose.Types.ObjectId(task.parentId3);
      _task.isActive = task.isActive;
      _task.hasChild = task.hasChild;
      _task.mother = new mongoose.Types.ObjectId(task.mother);
      _task.position = task.position;
      _task.createdDatetime = Date.now();
      _task.modifiedDatetime = Date.now();
      _task.whyInfo = task.whyInfo;
      _task.intentInfo = task.intentInfo;
      _task.endstateInfo = task.endstateInfo;
      _task.classification = task.classification;

      _task.save().then().catch((ex) => { res.status(400).send(ex); });
    });


    res.status(201).send('done');

    // fixTasksLocal(taskList);


    /*

    const numBody = req.body.num;
    let numBodyArr = numBody.split('.');
    numBodyArr.pop();
    const motherNum = numBodyArr.join('.');

    const _task = new Task();

    _task.wbsId = wbsId;
    _task.taskId = `${numBody}-${wbsId}`;
    _task.taskName = fixedText(req.body.taskName);
    _task.num = req.body.num;
    _task.task = req.body.task;
    _task.level = req.body.level;
    _task.priority = req.body.priority;
    _task.resources = req.body.resources;
    _task.isAssigned = req.body.isAssigned;
    _task.status = req.body.status;
    _task.hoursBest = parseFloat(req.body.hoursBest.trim(), 10);
    _task.hoursWorst = parseFloat(req.body.hoursWorst.trim(), 10);
    _task.hoursMost = parseFloat(req.body.hoursMost.trim(), 10);
    _task.estimatedHours = parseFloat(req.body.estimatedHours.trim(), 10);
    _task.startedDatetime = req.body.startedDatetime;
    _task.dueDatetime = req.body.dueDatetime;
    _task.links = req.body.links;
    _task.parentId1 = req.body.parentId1;
    _task.parentId2 = req.body.parentId2;
    _task.parentId3 = req.body.parentId3;
    _task.isActive = req.body.isActive;
    _task.mother = `${motherNum}-${wbsId}`;
    _task.position = req.body.position;
    _task.createdDatetime = Date.now();
    _task.modifiedDatetime = Date.now();

    _task
      .save()
      .then((result) => {
        res.status(201).send(result);
      })
      .catch((errors) => { res.status(400).send(errors); });

      */
  };

  const postTask = (req, res) => {
    if (req.body.requestor.role !== 'Administrator') {
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

    const _task = new Task();
    _task.wbsId = wbsId;
    _task.taskName = req.body.taskName;
    _task.num = req.body.num;
    _task.task = req.body.task;
    _task.level = parseInt(req.body.level, 10);
    _task.priority = req.body.priority;
    _task.resources = req.body.resources;
    _task.isAssigned = req.body.isAssigned;
    _task.status = req.body.status;
    _task.hoursBest = req.body.hoursBest;
    _task.hoursWorst = req.body.hoursWorst;
    _task.hoursMost = req.body.hoursMost;
    _task.estimatedHours = req.body.estimatedHours;
    _task.startedDatetime = req.body.startedDatetime;
    _task.dueDatetime = req.body.dueDatetime;
    _task.links = req.body.links;
    _task.parentId1 = req.body.parentId1;
    _task.parentId2 = req.body.parentId2;
    _task.parentId3 = req.body.parentId3;
    _task.isActive = req.body.isActive;
    _task.mother = req.body.mother;
    _task.position = req.body.position;
    _task.createdDatetime = Date.now();
    _task.modifiedDatetime = Date.now();
    _task.whyInfo = req.body.whyInfo;
    _task.intentInfo = req.body.intentInfo;
    _task.endstateInfo = req.body.endstateInfo;
    _task.classification = req.body.classification;

    _task
      .save()
      .then(result => res.status(201).send(result))
      .catch((errors) => {
        res.status(400).send(errors);
      });
  };

  const updateNum = (req, res) => {
    if (req.body.requestor.role !== 'Administrator') {
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

  const updateNumById = (taskId, currNum, newNum, res) => {
    Task.findById(taskId, (error, task) => {
      task.num = task.num.replace(currNum, newNum);
      task
        .save()
        .then()
        .catch(errors => res.status(400).send(errors));
    });
  };

  const moveTask = (req, res) => {
    if (!req.body.fromNum || !req.body.toNum) {
      res
        .status(400)
        .send({ error: 'wbsId, fromNum, toNum are mandatory fields' });
      return;
    }

    Task.find({ wbsId: { $in: req.params.wbsId } }).then((tasks) => {
      // list of affected tasks

      const fromNum = req.body.fromNum.split('.0')[0];
      const fromNumArr = fromNum.split('.');
      const fromLastPart = fromNumArr.pop();

      const toNum = req.body.toNum.split('.0')[0];
      const toNumArr = toNum.split('.');
      const toLastPart = toNumArr.pop();
      const toFirstPart = toNumArr.join('.');

      const isFromSmaller = parseInt(fromLastPart, 10) < parseInt(toLastPart, 10);

      const numChangeList = [];
      const numChangeValueList = [isFromSmaller ? toNum : fromNum];

      let finalChangeList = [];
      let finalChangeValueList = [];

      if (!isFromSmaller) {
        for (
          let i = parseInt(toLastPart, 10);
          i < parseInt(fromLastPart, 10);
          i += 1
        ) {
          numChangeList.push(
            `${toFirstPart.length > 0 ? `${toFirstPart}.` : ''}${i}`,
          );
        }
        finalChangeList = [...numChangeValueList, ...numChangeList];
        finalChangeValueList = [...numChangeList, fromNum];
      } else {
        for (
          let i = parseInt(fromLastPart, 10);
          i < parseInt(toLastPart, 10);
          i += 1
        ) {
          numChangeList.push(
            `${toFirstPart.length > 0 ? `${toFirstPart}.` : ''}${i}`,
          );
        }

        finalChangeList = [...numChangeList, ...numChangeValueList];
        finalChangeValueList = [...numChangeValueList, ...numChangeList];
      }

      const idList = [];

      // find ids
      finalChangeList.forEach((item) => {
        const tmpList = [];
        tasks.forEach((task) => {
          if (task.num.indexOf(item) === 0) {
            tmpList.push(task._id);
          }
        });
        idList.push(tmpList);
      });

      // update
      idList.forEach((ids, index) => {
        ids.forEach((id) => {
          updateNumById(
            id,
            finalChangeList[index],
            finalChangeValueList[index],
            res,
          );
        });
      });
    });
  };

  const deleteTask = (req, res) => {
    /* if (req.body.requestor.role !== 'Administrator') {
      res
        .status(403)
        .send({ error: 'You are  not authorized to delete tasks.' });
      return;
    } */
    const { taskId } = req.params;
    const { mother } = req.params;
    Task.find(
      {
        $or: [
          { _id: taskId },
          { parentId1: taskId },
          { parentId2: taskId },
          { parentId3: taskId },
        ],
      },
      (error, record) => {
        if (error || !record || record === null || record.length === 0) {
          res.status(400).send({ error: 'No valid records found' });
          return;
        }
        // resetNum(taskId, mother);
        const removeTasks = [];
        record.forEach((rec) => {
          removeTasks.push(rec.remove());
        });


        Promise.all([...removeTasks])
          .then(() => {
            // updateParents(record[0].wbsId, record[0].parentId1);
            resetNum(taskId, mother);
            return res
              .status(200)
              .send({ message: ' Task successfully deleted' });
          })
          .catch((errors) => {
            res.status(400).send(errors);
          });
      },
    ).catch((errors) => {
      res.status(400).send(errors);
    });
  };

  const deleteTaskByWBS = (req, res) => {
    /* if (req.body.requestor.role !== 'Administrator') {
      res
        .status(403)
        .send({ error: 'You are  not authorized to delete tasks.' });
      return;
    } */
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
    if (req.body.requestor.role !== 'Administrator') {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    const { taskId } = req.params;
    const task = req.body;

    Task.findById(taskId, (error, _task) => {
      _task.taskName = task.taskName;
      _task.priority = task.priority;
      _task.resources = task.resources;
      _task.isAssigned = task.isAssigned;
      _task.status = task.status;
      _task.hoursBest = task.hoursBest;
      _task.hoursWorst = task.hoursWorst;
      _task.hoursMost = task.hoursMost;
      _task.estimatedHours = task.estimatedHours;
      _task.startedDatetime = task.startedDatetime;
      _task.dueDatetime = task.dueDatetime;
      _task.links = task.links;
      _task.modifiedDatetime = Date.now();
      _task.whyInfo = req.body.whyInfo;
      _task.intentInfo = req.body.intentInfo;
      _task.endstateInfo = req.body.endstateInfo;
      _task.classification = req.body.classification;
      _task
        .save()
        .then(result => res.status(201).send(result))
        .catch((errors) => {
          res.status(400).send(errors);
        });
    });
  };

  const swap = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
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
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };


  const updateAllParents = (req, res) => {
    const { wbsId } = req.params;

    try {
      Task.find({ wbsId: { $in: [wbsId] } })
        .then((tasks) => {
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

  const getTasksByUserId = (req, res) => {
    const { userId } = req.params;

    try {
      Task.find({ 'resources.userID': userId }).then((results) => {
        res.status(200).send(results);
      });
    } catch (error) {
      res.status(400).send(error);
    }
  };

  return {
    postTask,
    getTasks,
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
  };
};

module.exports = taskController;
