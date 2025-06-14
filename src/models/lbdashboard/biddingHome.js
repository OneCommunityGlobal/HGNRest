const mongoose = require('mongoose');

const { Schema } = mongoose;

const biddingHomeSchema = new Schema({
    title: { type: String, required: true, maxLength: 255 },
    initialPrice: { type: Number, required: true },
    createdOn: { type: Date, required: true, default: Date.now },
    createdBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'userProfile',
        required: true,
    },
    description: { type: String },
    images: { type: [String] },
    amenities: { type: [String] },
    updatedOn: { type: Date, required: true, default: Date.now },
    updatedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'userProfile',
        required: true,
    },
    currentPrice: { type: Number, required: true },
    finalPrice: { type: Number, required: true },
    status: { type: String, required: true, enum: ['draft', 'complete'], default: 'draft' },
    village: { type: String },
    location: { type: String, required: true },
});

module.exports = mongoose.model('biddingHome', biddingHomeSchema, 'biddingHome');