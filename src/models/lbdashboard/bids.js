const mongoose = require('mongoose');

const { Schema } = mongoose;

const bidSchema = new Schema({
  userId: { type: mongoose.SchemaTypes.ObjectId, ref: 'users' },
  listingId: { type: mongoose.SchemaTypes.ObjectId, ref: 'listings' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  // bidPrice: { type: mongoose.SchemaTypes.Decimal128, required: true },
  termsAgreed: { type: Boolean, required: true, default: false },
 //   orderId: { type: String, required: true },
 
  paypalOrderId: { type: String // , required: true 
  },
  paypalCheckoutNowLink: {type:String},
  biddingHistory: [
    {
      bidPrice: { type: mongoose.SchemaTypes.Decimal128, required: true },
      createdDatetime: { type: Date },
    },
  ],
  /* status: { type:String, required:true, default:"Bid Received"}
    "Bid won", "Payment processing Started", "Payment Error"
    "Payment Completed",
    Highest Bidder → The bid is currently the highest.
Outbid → A higher bid has been placed.
Won → The bidder has won the auction.
Lost → The bid was not the highest when the auction ended.
  totalPrice: { type: mongoose.SchemaTypes.Decimal128, required: true },
  
  */
  isActive: { type: Boolean, required: true, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
});

module.exports = mongoose.model('Bids', bidSchema, 'bids');
