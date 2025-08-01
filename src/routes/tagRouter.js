const express = require('express');

const routes = function (Tag) {
  const tagRouter = express.Router();
  const controller = require('../controllers/tagController')(Tag);

  // Get most frequent tags with optional filtering by project and date range
  tagRouter.route('/tags/frequent')
    .get(controller.getFrequentTags);

  // Get tag suggestions for autocomplete
  tagRouter.route('/tags/suggestions')
    .get(controller.getTagSuggestions);

  // Get tags for a specific project
  tagRouter.route('/tags/project/:projectId')
    .get(controller.getTagsByProject);

  // Get, update, or delete a specific tag by ID
  tagRouter.route('/tags/:tagId')
    .get(controller.getTagById)
    .delete(controller.deleteTag);

  // Create or update a tag
  tagRouter.route('/tags')
    .post(controller.upsertTag);

  return tagRouter;
};

module.exports = routes;