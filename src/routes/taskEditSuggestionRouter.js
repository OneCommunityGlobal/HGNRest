/* eslint-disable linebreak-style */
const express = require('express');

const routes = function (TaskEditSuggestion) {
  const controller = require('../controllers/taskEditSuggestionController')(
    TaskEditSuggestion,
  );
  const TaskEditSuggestionRouter = express.Router();

  TaskEditSuggestionRouter.route('/taskEditSuggestion')
    .post(controller.createTaskEditSuggestion);

  TaskEditSuggestionRouter.route('/taskEditSuggestion')
    .get(controller.findAllTaskEditSuggestions);

  TaskEditSuggestionRouter.route('/taskEditSuggestion/:taskEditSuggestionId')
    .delete(controller.deleteTaskEditSuggestion);

  return TaskEditSuggestionRouter;
};

module.exports = routes;
