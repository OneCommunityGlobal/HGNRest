const mongoose = require('mongoose');

const { Schema } = mongoose;

const mapLocation = new Schema({
    title: {
        type: String,
        default: 'Prior to HGN Data Collection'
    },
    firstName: String,
    lastName: String,
    jobTitle: String,
    isActive: {
        type: Boolean,
        default: false,
    },
    location: {
        userProvided: {
            type: String,
            required: true,
        },
        coords: {
            lat: {
                type: String,
                required: true,
            },
            lng: {
                type: String,
                required: true,
            }
        },
        country: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            default: '',
        },
    },
});

module.exports = mongoose.model('MapLocation', mapLocation, 'maplocations');
