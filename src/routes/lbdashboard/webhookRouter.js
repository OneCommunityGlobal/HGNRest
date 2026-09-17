const express = require('express');
const Payments = require('../../models/lbdashboard/payments');
const webHookController = require('../../controllers/lbdashboard/webhookController')(Payments);

const webhookRouter = express.Router();
const paypalAuthMiddleware = require('../../startup/middleware');

webhookRouter.route('/webhook').post(webHookController.myHook);
webhookRouter.route('/myWebhooks').post(paypalAuthMiddleware, webHookController.webhookTest);

module.exports = webhookRouter;
