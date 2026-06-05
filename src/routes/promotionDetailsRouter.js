const express = require('express');

const promotionDetailsRouter = express.Router();
const controller = require('../controllers/promotionDetailsController')();

promotionDetailsRouter.route('/promotion-details/:reviewerId').get(controller.promotionDetails);

module.exports = promotionDetailsRouter;
