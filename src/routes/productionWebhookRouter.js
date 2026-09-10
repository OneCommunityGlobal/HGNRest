const express = require('express');
const productionWebhookController = require('../controllers/productionWebhookController');

const productionWebhookRouter = express.Router();

productionWebhookRouter.post(
  '/webhooks/production-user-status',
  productionWebhookController.handleProductionUserStatus,
);

module.exports = productionWebhookRouter;
