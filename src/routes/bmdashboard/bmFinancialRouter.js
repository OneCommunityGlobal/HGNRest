const express = require('express');
const logger = require('../../startup/logger');

const routes = function (buildingProjectModel, buildingMaterialModel, buildingToolModel) {
    const router = express.Router();
    const financialController = require('../../controllers/bmdashboard/bmFinancialController')(
        buildingProjectModel,
        buildingMaterialModel,
        buildingToolModel
    );

    // Total Project Cost
    router.get('/project/:projectId/total-cost', (req, res) => {
        logger.logInfo(`Calling the API with Project ID: ${req.params.projectId}`);
        financialController.getTotalProjectCost(req, res);
    });

    // Project Cost Breakdown
    router.get('/project/:projectId/costs', (req, res) => {
        logger.logInfo(`Fetching cost breakdown for Project ID: ${req.params.projectId}`);
        financialController.getCostBreakdown(req, res);
    });

    // Month-over-Month Percentage Changes
    router.get('/project/:projectId/mom-changes', (req, res) => {
        logger.logInfo(`Fetching MoM changes for Project ID: ${req.params.projectId}`);
        financialController.getMonthOverMonthChanges(req, res);
    });

    // Projects Financial Data by Project Type or Date Range
    router.get('/projects', (req, res) => {
        const {startDate, endDate, projectType} = req.query;

        if (startDate && endDate) {
            logger.logInfo(`Fetching financial data from ${startDate} to ${endDate}`);
            financialController.getProjectsFinancialsByDateRange(req, res);
        } else if (projectType) {
            logger.logInfo(`Fetching financial data for project type: ${projectType}`);
            financialController.getProjectsFinancialsByType(req, res);
        } else {
            logger.logException('Invalid query parameters');
            res.status(400).json({
                message: 'Invalid query parameters. Provide startDate & endDate or projectType.'
            });
        }
    });

    return router;
};

module.exports = routes;
