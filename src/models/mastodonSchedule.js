const mongoose = require('mongoose');
const { Schema } = mongoose;

const mastodonSchedule = new Schema({
    postData: { type: String, required: true },
    scheduledTime: { type: Date, required: true },
});

module.exports = mongoose.model('mastodonSchedule', mastodonSchedule);