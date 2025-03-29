const mongoose = require('mongoose');

const { Schema } = mongoose;

const paymentSchema = new Schema({
  orderId: { type: String, required: true },
  authorizationsId: { type: String, required: true },
  payment_source: {
    card: {
      lastDigits: { type: String, required: true },
      expiry: { type: String, required: true },
      brand: { type: String, required: true },
    },
  },
  purchase_units: {
    payments: {
      amount: { type: mongoose.SchemaTypes.Decimal128, required: true },
      expirationTime: { type: Date },
    },
  },
  userId: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'users' }],
  bidId: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'bids' }],

  isActive: { type: Boolean, required: true, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
  status: { type: String, required: true },
});

module.exports = mongoose.model('Payments', paymentSchema, 'payments');
