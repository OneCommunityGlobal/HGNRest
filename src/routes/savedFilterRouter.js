const express = require('express');

const routes = function (savedFilter) {
  const controller = require('../controllers/savedFilterController')(savedFilter);

  const savedFilterRouter = express.Router();

  // Get all saved filters
  savedFilterRouter.get('/savedFilters', controller.getAllSavedFilters);

  // Create a new saved filter
  savedFilterRouter.post('/savedFilters', controller.createSavedFilter);

  // Update a saved filter
  savedFilterRouter.put('/savedFilters/:filterId', controller.updateSavedFilter);

  // Delete a saved filter
  savedFilterRouter.delete('/savedFilters/:filterId', controller.deleteSavedFilter);

  // Update saved filters when team codes change
  savedFilterRouter.patch(
    '/savedFilters/updateTeamCodes',
    controller.updateSavedFiltersForTeamCodeChange,
  );

  // Update saved filters when individual team code changes
  savedFilterRouter.patch(
    '/savedFilters/updateIndividualTeamCode',
    controller.updateSavedFiltersForIndividualTeamCodeChange,
  );

  return savedFilterRouter;
};

module.exports = routes;
