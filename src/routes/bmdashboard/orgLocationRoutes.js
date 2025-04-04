const express = require("express");

const routes = function () {
    const NewOrgRouter = express.Router();
    const orgLocationController = require('../../controllers/bmdashboard/bmOrgsController')();

    NewOrgRouter.route('/orgLocation').get(orgLocationController.getAllOrgs);

    NewOrgRouter.route('/orgLocation/:id').get(orgLocationController.getOrgById);

    return NewOrgRouter;
};

module.exports = routes;
