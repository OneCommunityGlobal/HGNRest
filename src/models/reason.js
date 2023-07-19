const mongoose = require('mongoose')
const User = require('./userProfile')
const moment = require('moment-timezone')

const reasonSchema = new mongoose.Schema({
    reason: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: moment().tz('America/Los_Angeles').endOf('week')
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: User,
        required: true
    }
})

const Reason = mongoose.model('Reason', reasonSchema)

module.exports = Reason;