/* eslint-disable linebreak-style */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const wbs = require('../models/wbs');

const taskEditSuggestionController = function (TaskEditSuggestion) {
  const createOrUpdateTaskEditSuggestion = async function (req, res) {
    try {
      const profile = await userProfile.findById(mongoose.Types.ObjectId(req.body.userId)).select('firstName lastName');
      const wbsProjectId = await wbs.findById(mongoose.Types.ObjectId(req.body.oldTask.wbsId)).select('projectId');
      const projectMembers = await userProfile.find({ projects: mongoose.Types.ObjectId(wbsProjectId.projectId) }, '_id firstName lastName profilePic').sort({ firstName: 1, lastName: 1 });

      const taskIdQuery = { taskId: mongoose.Types.ObjectId(req.body.taskId) };
      const update = {
        userId: req.body.userId,
        user: `${profile.firstName} ${profile.lastName}`,
        dateSuggested: Date.now(),
        taskId: req.body.taskId,
        wbsId: req.body.oldTask.wbsId,
        projectId: wbsProjectId.projectId,
        oldTask: req.body.oldTask,
        newTask: req.body.newTask,
        projectMembers,
      };
      const options = {
        upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true,
      };
      const tes = await TaskEditSuggestion.findOneAndUpdate(taskIdQuery, update, options);
      res.status(200).send(tes);
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
    createOrUpdateTaskEditSuggestion,
    findAllTaskEditSuggestions,
    deleteTaskEditSuggestion,
  };
};

module.exports = taskEditSuggestionController;
