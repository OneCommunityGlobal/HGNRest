const mongoose = require('mongoose');
const moment = require('moment-timezone');
const User = require('./userProfile');

const { Schema } = mongoose;

const EventSchema = new Schema({
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
        default: () => moment().tz('America/Los_Angeles').format()
    },
    endTime: { 
        type: String,
        required: true,
        default: () => moment().tz('America/Los_Angeles').add(1, 'hour').format()
    },
    date: {
        type: Date, 
        required: true,
        default: moment().tz('America/Los_Angeles').endOf('week').format(),
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
        profilePic: { type: String },
        location: { type: String, enum: ['Virtual', 'In person'] },
      }],
    coverImage: { type: String },
    maxAttendees: { type: Number, required: true },
    currentAttendees: { type: Number, default: 0 },
    attendeesThreshold: { type: Number},
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

EventSchema.pre('save', function (next) {
    this.attendeesThreshold = Math.floor(this.maxAttendees * 0.75);
    next();
});

const Event = mongoose.model('Event', EventSchema);
module.exports = Event;