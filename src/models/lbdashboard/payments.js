const mongoose = require('mongoose');

const { Schema } = mongoose;

const paymentSchema = new Schema({
  paypalOrderId: { type: String, required: true },
  paypalAuthorizationsId: { type: String, required: false },
  paypalExpirationTime:{ type: Date },
  paypalCreateTime: { type: Date },    
  payment_source: {
    card: {
      lastDigits: { type: String, required: false },
      expiry: { type: String, required: false },
      brand: { type: String, required: false },
    },
  },
  purchase_units: {
    payments: {
      amount: { type: mongoose.SchemaTypes.Decimal128, required: true },
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
