const express = require('express');
const productionIdentityController = require('../controllers/productionIdentityController');

const productionIdentityRouter = express.Router();

productionIdentityRouter.post(
  '/production-identity/verify',
  productionIdentityController.verifyProductionIdentity,
);

productionIdentityRouter.post(
  '/production-identity/public-verify',
  productionIdentityController.verifyProductionIdentityPublic,
);

module.exports = productionIdentityRouter;
