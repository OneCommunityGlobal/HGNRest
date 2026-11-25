const express = require('express');

const routes = function () {
  const NewOrgRouter = express.Router();

  const orgLocationController = require('../../controllers/bmdashboard/bmOrgsController')();

  NewOrgRouter.route('/orgLocation')
    .get(orgLocationController.getAllOrgs)
    .post(orgLocationController.createOrg);

  NewOrgRouter.route('/orgLocation/:id')
    .get(orgLocationController.getOrgById)
    .put(orgLocationController.updateOrg)
    .delete(orgLocationController.deleteOrg);

  return NewOrgRouter;
};

module.exports = routes;
