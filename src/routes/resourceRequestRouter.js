const express = require('express');

const routes = function (ResourceRequest, UserProfile) {
  const resourceRequestRouter = express.Router();
  const controller = require('../controllers/resourceRequestController')(ResourceRequest);

  // POST /educator/resource-requests - Educator submits a new request
  resourceRequestRouter.route('/educator/resource-requests').post(controller.createResourceRequest);

  // GET /educator/resource-requests - Educator views their own request history
  resourceRequestRouter.route('/educator/resource-requests').get(controller.getEducatorRequests);

  // GET /pm/resource-requests - PM views all requests, with filters for status
  resourceRequestRouter.route('/pm/resource-requests').get(controller.getPMRequests);

  // PUT /pm/resource-requests/:requestId - PM updates a request's status
  resourceRequestRouter
    .route('/pm/resource-requests/:requestId')
    .put(controller.updateRequestStatus);

  return resourceRequestRouter;
};

module.exports = routes;

