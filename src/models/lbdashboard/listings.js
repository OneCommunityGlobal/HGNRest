const mongoose = require('mongoose');

const { Schema } = mongoose;

const listings = new Schema({
    title: { type: String, required: true, maxLength: 255 },
    price: { type: String, required: true },
    createdOn: { type: Date, required: true, default: Date.now },
    createdBy: { 
        type: mongoose.SchemaTypes.ObjectId, 
        ref: 'userProfile', 
        required: true 
    },
    description: { type: String, required: true },
    images: { type: [String], required: true },
    amneties: { type: [String], required: true },
    availability: { type: String, required: true },
    updatedOn: { type: Date, required: true, default: Date.now },
    status: { type: String, required: true, default: 'draft' },
});

listings.index({ price: -1 }); 
listings.index({ price: 1 }); 
listings.index({ createdOn: -1 });
listings.index({ createdOn: 1 });

module.exports = mongoose.model('listings', listings, 'listings');