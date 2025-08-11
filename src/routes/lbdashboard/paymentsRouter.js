const express = require('express');
const Payments = require('../../models/lbdashboard/payments');
const paymentsController = require('../../controllers/lbdashboard/paymentsController')(Payments);

const paymentsRouter = express.Router();

paymentsRouter
  .route('/payments')
  .get(paymentsController.getPayments)
  .post(paymentsController.postPayments);

module.exports = paymentsRouter;
