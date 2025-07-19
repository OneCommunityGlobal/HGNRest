const express = require('express');

const promotionTableRouter = express.Router();
const controller = require('../controllers/promotionTableController')();

promotionTableRouter.get('/review-for-this-week', controller.reviewForThisWeek);
promotionTableRouter.post('/process-promotions', controller.processPromotions);
promotionTableRouter.route('/').get(controller.getPromotionEligibility);

module.exports = promotionTableRouter;
