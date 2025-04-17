const mongoose = require('mongoose');

const { Schema } = mongoose;

const bookingsModel = new Schema({
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    listingId: { type: mongoose.SchemaTypes.ObjectId, ref: 'listings', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true },
    createdOn: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Booking', bookingsModel);