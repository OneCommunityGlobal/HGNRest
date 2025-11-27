const express = require('express');

module.exports = function (ResourceRequest, UserProfile, controller) {
  const router = express.Router();

  router.post(
    '/educator/resource-requests',
    controller.createResourceRequest
  );

  router.get(
    '/educator/resource-requests',
    controller.getEducatorResourceRequests
  );

  router.get(
    '/pm/resource-requests',
    controller.getPMResourceRequests
  );

  router.put(
    '/pm/resource-requests/:id',
    controller.updatePMResourceRequestStatus
  );

  return router;
};
