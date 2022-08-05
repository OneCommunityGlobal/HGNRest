/* eslint-disable linebreak-style */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const wbs = require('../models/wbs');

const taskEditSuggestionController = function (TaskEditSuggestion) {
  const createTaskEditSuggestion = async function (req, res) {
    try {
      const taskEditSuggestion = new TaskEditSuggestion();
      taskEditSuggestion.userId = req.body.userId;

      const profile = await userProfile.findById(mongoose.Types.ObjectId(taskEditSuggestion.userId)).select('firstName lastName');
      taskEditSuggestion.user = `${profile.firstName} ${profile.lastName}`;

      taskEditSuggestion.dateSuggested = Date.now();
      taskEditSuggestion.taskId = req.body.taskId;
      taskEditSuggestion.oldTask = req.body.oldTask;
      const wbsProjectId = await wbs.findById(mongoose.Types.ObjectId(req.body.oldTask.wbsId)).select('projectId');
      taskEditSuggestion.oldTask.projectId = wbsProjectId.projectId;
      taskEditSuggestion.newTask = req.body.newTask;
      const result = await taskEditSuggestion.save();
      res.status(201).send(result);
    } catch (error) {
      console.log(error);
      res.status(400).send(error);
    }
  };

  const findAllTaskEditSuggestions = async function (req, res) {
    try {
      if (req.query.count === 'true') {
        const count = await TaskEditSuggestion.countDocuments();
        res.status(200).send({ count });
      } else {
        const result = await TaskEditSuggestion.find();
        res.status(200).send(result);
      }
    } catch (error) {
      res.status(400).send(error);
    }
  };

  const deleteTaskEditSuggestion = async function (req, res) {
    try {
      await TaskEditSuggestion.deleteOne(req.param.taskEditSuggestionId);
      res.status(200).send({ message: `Deleted task edit suggestion with _id: ${req.param.taskEditSuggestionId}` });
    } catch (error) {
      res.status(400).send(error);
    }
  };

  return {
    createTaskEditSuggestion,
    findAllTaskEditSuggestions,
    deleteTaskEditSuggestion,
  };
};

module.exports = taskEditSuggestionController;
