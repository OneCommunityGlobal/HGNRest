const mongoose = require('mongoose');
const moment = require('moment-timezone');
const User = require('./userProfile');

const reasonSchema = new mongoose.Schema({
    reason: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: moment().tz('America/Los_Angeles').endOf('week'),
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: User,
        required: true,
    },
    isSet: {
        type: Boolean,
        required: true,
        default: true,
    },
});

const Reason = mongoose.model('Reason', reasonSchema);

module.exports = Reason;
