const express = require ("express");

const routes = function() {
    // initialize routes 
    const NewOrgRouter = express.Router();
    const orgLocationController = require('../../controllers/bmdashboard/bmOrgsController')();

    // get all organizations 
    NewOrgRouter.route('/orgLocation').get(orgLocationController.getAllOrgs);

    // get one organization by it's ID
    NewOrgRouter.route('/orgLocation/:id').get(orgLocationController.getOrgById);

    return NewOrgRouter;
};

module.exports = routes;