const express = require('express');

const routes = function () {
  const toolAvailabilityRouter = express.Router();

  // GET /api/bm/projects/:id/tools-availability
  toolAvailabilityRouter
    .route('/bm/projects/:id/tools-availability')
    .get((req, res) => res.json({ message: 'Get tools availability' }));

  // GET /api/bm/tools-availability/projects
  toolAvailabilityRouter
    .route('/bm/tools-availability/projects')
    .get((req, res) => res.json({ message: 'Get unique project IDs' }));

  return toolAvailabilityRouter;
};

module.exports = routes;
