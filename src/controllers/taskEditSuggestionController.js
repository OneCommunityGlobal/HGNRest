/* eslint-disable linebreak-style */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');

const taskEditSuggestionController = function (TaskEditSuggestion) {
  const createTaskEditSuggestion = async function (req, res) {
    try {
      const taskEditSuggestion = new TaskEditSuggestion();
      taskEditSuggestion.userId = req.body.userId;

      const profile = await userProfile.findById(mongoose.Types.ObjectId(taskEditSuggestion.userId));
      taskEditSuggestion.user = `${profile.firstName} ${profile.lastName}`;

      taskEditSuggestion.dateSuggested = Date.now();
      taskEditSuggestion.taskId = req.body.taskId;
      taskEditSuggestion.oldTask = req.body.oldTask;
      taskEditSuggestion.newTask = req.body.newTask;
      const result = await taskEditSuggestion.save();
      res.status(201).send(result);
    } catch (error) {
      res.status(400).send(error);
    }
  };

  const findAllTaskEditSuggestions = async function (req, res) {
    try {
      const result = await TaskEditSuggestion.find();
      res.status(200).send(result);
    } catch (error) {
      res.status(400).send(error);
    }
  };

  const deleteTaskEditSuggestion = function (req, res) {
    TaskEditSuggestion.findById(req.params.taskNotificationId)
      .then((result) => {
        result
          .remove()
          .then(res.status(200).send({ message: 'Deleted task edit suggestion' }))
          .catch((error) => {
            res.status(400).send(error);
          });
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  return {
    createTaskEditSuggestion,
    findAllTaskEditSuggestions,
    deleteTaskEditSuggestion,
  };
};

module.exports = taskEditSuggestionController;
