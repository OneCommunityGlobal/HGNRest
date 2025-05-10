const express = require("express");
const controller = require('../controllers/materialSusceptibleController');

const routes = function() {

    const newMaterialRouter = express.Router();
    newMaterialRouter.route('/projectMaterial').get(controller.getAllMaterial);
    return newMaterialRouter;
};

module.exports = routes;