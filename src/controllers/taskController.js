// const mongoose = require('mongoose');
const taskController = function (Task) {
  const getTasks = (req, res) => {
    Task.find(
      {
        wbsId: { $in: [req.params.wbsId] },
      },
    )
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
      const childTasks = tasks.filter(taskChild => taskChild.level === (level + 1));
      let sumHoursBest = 0;
      let sumHoursWorst = 0;
      let sumHoursMost = 0;
      let sumEstimatedHours = 0;
      const resources = [];
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task._id)) {
          hasChild = true;
          sumHoursBest += childTask.hoursBest;
          sumHoursWorst += childTask.hoursWorst;
          sumHoursMost += childTask.hoursMost;
          sumEstimatedHours += childTask.estimatedHours;
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
        updateSumUp(task._id, sumHoursBest, sumHoursWorst, sumHoursMost, sumEstimatedHours, resources);
      }
    });
    return tasks;
  };

  const setDatesSubTasks = (level, tasks) => {
    const parentTasks = tasks.filter(task => task.level === level);
    parentTasks.forEach((task) => {
      const childTasks = tasks.filter(taskChild => taskChild.level === (level + 1));
      let minStartedDate = task.startedDatetime;
      let maxDueDatetime = task.dueDatetime;
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task._id)) {
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
      const childTasks = tasks.filter(taskChild => taskChild.level === (level + 1));
      let totalNumberPriority = 0;
      let totalChild = 0;
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task._id)) {
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
      const childTasks = tasks.filter(taskChild => taskChild.level === (level + 1));
      let isAssigned = false;
      let hasChild = false;
      childTasks.forEach((childTask) => {
        if (childTask.mother.equals(task._id)) {
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


  const updateParents = (wbsId) => {
    Task.find({ wbsId: { $in: [wbsId] } })
      .then((tasks) => {
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

  const resetNum = (wbsId) => {
    Task.find({ wbsId: { $in: [wbsId] } })
      .then((tasks) => {
        const sortedTasks = tasks.sort((a, b) => {
          if (a.num < b.num) {
            return -1;
          }
          if (a.num > b.num) {
            return 1;
          }
          return 0;
        });
        const numLvs = [0, 0, 0, 0];
        let lastLevel = 1;
        sortedTasks.forEach((task) => {
          if (task.level === lastLevel) {
            numLvs[task.level - 1] += 1;
          } else {
            lastLevel = task.level;
            numLvs[task.level - 1] += 1;
            for (let i = task.level; i < 4; i += 1) {
              numLvs[i] = 0;
            }
          }

          updateTaskNums(task._id, numLvs.join('.'));
        });
      });
  };

  const importTask = async (req,res)=>{
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    if (!req.body.taskName || !req.body.isActive
    ) {
      res.status(400).send({ error: 'Task Name, Active status, Task Number are mandatory fields' });
      return;
    }

    const wbsId = req.params.id;

    const _task = new Task();
    _task.wbsId = wbsId;
    _task.taskName = req.body.taskName;
    _task.num = req.body.num;
    _task.task = req.body.task;
    _task.level = req.body.level;
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
  

    _task.save()
      .then((result) => {
        return res.status(201).send(result);
      })
      .catch((errors) => { res.status(400).send(errors); });
  }

  const postTask = (req, res) => {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    if (!req.body.taskName || !req.body.isActive
    ) {
      res.status(400).send({ error: 'Task Name, Active status, Task Number are mandatory fields' });
      return;
    }

    const wbsId = req.params.id;

    const _task = new Task();
    _task.wbsId = wbsId;
    _task.taskName = req.body.taskName;
    _task.num = req.body.num;
    _task.task = req.body.task;
    _task.level = req.body.level;
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

    _task.save()
      .then((result) => {
        updateParents(_task.wbsId);
        resetNum(_task.wbsId);
        return res.status(201).send(result);
      })
      .catch((errors) => { res.status(400).send(errors); });
  };

  const updateNum = (req, res) => {
    if (req.body.requestor.role !== 'Administrator') {
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
        task.save()
          .then().catch(errors => res.status(400).send(errors));
      });

      // level 2
      Task.find({ parentId: { $in: [elm.id] } })
        .then((childTasks1) => {
          if (childTasks1.length > 0) {
            childTasks1.forEach((childTask1) => {
              childTask1.num = childTask1.num.replace(childTask1.num.substring(0, elm.num.length), elm.num);

              childTask1.save()
                .then().catch(errors => res.status(400).send(errors));

              // level 3
              Task.find({ parentId: { $in: [childTask1._id] } })
                .then((childTasks2) => {
                  if (childTasks2.length > 0) {
                    childTasks2.forEach((childTask2) => {
                      childTask2.num = childTask2.num.replace(childTask2.num.substring(0, childTask1.num.length), childTask1.num);

                      childTask2.save()
                        .then().catch(errors => res.status(400).send(errors));

                      // level 4
                      Task.find({ parentId: { $in: [childTask2._id] } })
                        .then((childTasks3) => {
                          if (childTasks3.length > 0) {
                            childTasks3.forEach((childTask3) => {
                              childTask3.num = childTask3.num.replace(childTask3.num.substring(0, childTask2.num.length), childTask2.num);

                              childTask3.save()
                                .then().catch(errors => res.status(400).send(errors));
                            });
                          }
                        }).catch(error => res.status(404).send(error));
                    });
                  }
                }).catch(error => res.status(404).send(error));
            });
          }
        }).catch(error => res.status(404).send(error));
    });

    res.status(200).send(true);
  };

  const deleteTask = (req, res) => {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are  not authorized to delete tasks.' });
      return;
    }
    const { taskId } = req.params;

    Task.find({ $or: [{ _id: taskId }, { parentId1: taskId }, { parentId2: taskId }, { parentId3: taskId }] }, (error, record) => {
      if (error || !record || (record === null) || (record.length === 0)) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }

      const removeTasks = [];
      record.forEach((rec) => {
        removeTasks.push(rec.remove());
      });


      Promise.all([...removeTasks])
        .then(() => {
          updateParents(record[0].wbsId);
          resetNum(record[0].wbsId);
          return res.status(200).send({ message: ' WBS successfully deleted' });
        })
        .catch((errors) => { res.status(400).send(errors); });
    }).catch((errors) => { res.status(400).send(errors); });
  };


  const updateTask = (req, res) => {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new Task.' });
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


      _task.save().then((result) => {
        updateParents(_task.wbsId);
        resetNum(_task.wbsId);
        return res.status(201).send(result);
      })
        .catch((errors) => { res.status(400).send(errors); });
    });
  };

  const swap = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new projects.' });
      return;
    }

    if (!req.body.taskId1 || !req.body.taskId2
    ) {
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

        task1.save()
          .then().catch(errors => res.status(400).send(errors));

        task2.save()
          .then().catch(errors => res.status(400).send(errors));


        Task.find(
          {
            wbsId: { $in: [task1.wbsId] },
          },
        )
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

  const saveParents = function (updatedTask, position) {
    let taskNumArr = updatedTask.num.split('.');
    let firstNum = parseInt(taskNumArr[0]);
    if(updatedTask.num ==='0'){
      firstNum = 1
    }
    let newNum = ++firstNum;
    for(let i=1; i<taskNumArr.length;i++){
      newNum += `.${taskNumArr[i]}`
    }
    console.log(newNum);

    Task.findById(updatedTask._id, (error, task) => {
      task.parentId1 = updatedTask.parentId1;
      task.parentId2 = updatedTask.parentId2;
      task.parentId3 = updatedTask.parentId3;
      task.mother = updatedTask.mother ;
      task.position = position;
      task.num = newNum;
      task.save();
    });
  }


  const fixTasks = function (req,res){
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new Task.' });
      return;
    }

    const wbsId = req.params.wbsId;

    Task.find({ wbsId: { $in: [wbsId] } })
      .then((tasks) => {

        let parentId1 = null;
        let parentId2 = null;
        let parentId3 = null;

        tasks.forEach((task,i)=>{
         
          if(task.level===1){
            parentId1 = task._id; // for task level 2
          }else if(task.level===2){
            task.parentId1 = parentId1; 
            task.mother = parentId1;
            parentId2 = task._id;
            saveParents(task,i);
          }else if(task.level===3){
            task.parentId1 = parentId1;
            task.parentId2 = parentId2;
            task.mother = parentId2;
            parentId3 = task._id;
            saveParents(task,i);
          }else if(task.level===4){
            task.parentId1 = parentId1;
            task.parentId2 = parentId2;
            task.parentId3 = parentId3;
            task.mother = parentId3;
            saveParents(task,i);
          }
          
        })
    });
    res.status(200).send('done');
  }

  return {
    postTask,
    getTasks,
    swap,
    updateNum,
    deleteTask,
    getTaskById,
    updateTask,
    importTask,
    fixTasks
  };
};


module.exports = taskController;
