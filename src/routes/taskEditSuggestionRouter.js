/* eslint-disable linebreak-style */
const express = require('express');

const routes = function (TaskEditSuggestion) {
  const controller = require('../controllers/taskEditSuggestionController')(
    TaskEditSuggestion,
  );
  const TaskEditSuggestionRouter = express.Router();

  TaskEditSuggestionRouter.route('/taskeditsuggestion')
    .post(controller.createOrUpdateTaskEditSuggestion);

  TaskEditSuggestionRouter.route('/taskeditsuggestion')
    .get(controller.findAllTaskEditSuggestions);

  TaskEditSuggestionRouter.route('/taskeditsuggestion/:taskEditSuggestionId')
    .delete(controller.deleteTaskEditSuggestion);

  return TaskEditSuggestionRouter;
};

module.exports = routes;
