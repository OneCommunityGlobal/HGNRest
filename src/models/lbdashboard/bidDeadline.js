const mongoose = require('mongoose');

const { Schema, SchemaTypes } = mongoose;

const bidDeadline = new Schema(
  {
    listingId: { type: SchemaTypes.ObjectId, ref: 'listings' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    biddingHistory: [
      {
        bidPrice: { type: SchemaTypes.Decimal128, required: true },
        createdDatetime: { type: Date, default: Date.now },
      },
    ],
    isActive: { type: Boolean, required: true, default: true },
    isClosed: { type: Boolean, required: false, default: false },
  },
  {
    timestamps: { createdAt: 'createdDatetime', updatedAt: 'modifiedDatetime' },
  },
);

module.exports = mongoose.model('BidDeadlines', bidDeadline, 'bidDeadlines');
