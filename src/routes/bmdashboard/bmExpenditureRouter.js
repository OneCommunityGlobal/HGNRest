const express = require("express");
const controller = require('../../controllers/bmdashboard/bmExpenditureController');

const routes = function() {

    const newExpenditureRouter = express.Router();
    newExpenditureRouter.route('/expenditure').get(controller.getAllExpenditure);
    return newExpenditureRouter;
};

module.exports = routes;