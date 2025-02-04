const mongoose = require('mongoose');
const moment = require('moment-timezone');
const User = require('./userProfile');

const { Schema } = mongoose;

const Event = new Schema({
    title: { type: String, required: true },
    type: { 
        type: String,
        enum: ['Workshop', 'Meeting', 'Webinar', 'Social Gathering'],
        required: true },
    location: {
        type: String,
        enum: ['Virtual', 'In person'],
        required: true,
    },
    startTime: { 
        type: String, 
        required: true,
        default: () => moment().tz('America/Los_Angeles').toDate()
    },
    endTime: { 
        type: String,
        required: true,
        default: () => moment().tz('America/Los_Angeles').add(1, 'hour').toDate()
    },
    date: {
        type: Date, 
        required: true,
        default: moment().tz('America/Los_Angeles').endOf('week'),
    },
    status: {
        type: String,
        enum: ['New', 'Need attendees', 'Filling Fast', 'Full'],
        default: 'New',
    },
    description: { type: String, required: true },
    resources: [{
        name: { type: String, required: true },
        userID: { type: mongoose.SchemaTypes.ObjectId, ref: User },
        profilePic: { type: String }
      }],
    maxAttendees: { type: Number, required: true },
    currentAttendees: { type: Number, default: 0 },
    attendeesThreshold: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Event', Event);