const express = require('express');
const ctrl = require('../controllers/xPostController');

const router = express.Router();

// Router is mounted at /x, so paths here are just the suffix.
const routes = [
  ['post', '/post', ctrl.createPost],
  ['post', '/schedule', ctrl.schedulePost],
  ['get', '/schedule', ctrl.getScheduled],
  ['delete', '/schedule/:id', ctrl.deleteScheduled],
  ['put', '/schedule/:id', ctrl.updateScheduledPost],
  ['patch', '/schedule/:id/mark-posted', ctrl.markAsPosted],
  ['patch', '/schedule/:id/skip', ctrl.skipPost],
  ['get', '/history', ctrl.getHistory],
];

routes.forEach(([method, path, handler]) => router[method](path, handler));

module.exports = router;
