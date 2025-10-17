const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Point'],
        required: true
    },
    coordinates: {
        type: [Number],
        required: true
    }
})
const OrgLocationSchema = new mongoose.Schema({
    orgId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String, 
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'delayed'],
        required: true
    },
    location: {
        type: pointSchema,
        required: true,
        index: '2dsphere'
    },
    country: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
})

// geospatial index
module.exports = mongoose.model('OrgLocation', OrgLocationSchema, 'orgLocation');
