const mongoose = require('mongoose');
const { Schema } = mongoose;

const pinterestSession = new Schema({
    sessionId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    expireAt: { type: Date, expires: 300 }, //session expires after 5 mins
});

module.exports = mongoose.model('pinterestSession', pinterestSession);