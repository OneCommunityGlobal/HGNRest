const mongoose = require('mongoose');

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
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
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
})

// geospatial index
OrgLocationSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('OrgLocation', OrgLocationSchema);
