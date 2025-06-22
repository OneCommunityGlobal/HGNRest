const mongoose = require('mongoose');

const { Schema } = mongoose;

const bidListingSchema = new Schema({
    title: { type: String, required: true, maxLength: 255, trim: true },
    initialPrice: { type: Number, required: true },
    description: { type: String, trim: true },
    images: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    createdBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'userProfile',
        required: true,
    },
    updatedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'userProfile',
        required: true,
    },
    currentPrice: { type: Number, required: true },
    finalPrice: { type: Number, required: true },
    status: { type: String, required: true, enum: ['draft', 'complete'], default: 'draft' },
    village: { type: mongoose.SchemaTypes.ObjectId, ref: 'village', required: true },
    location: { type: String, required: true, trim: true },
}, { timestamps: { createdAt: 'createdOn', updatedAt: 'updatedOn' } });

module.exports = mongoose.model('bidListing', bidListingSchema, 'bidListing');