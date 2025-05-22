const mongoose = require('mongoose');

const { Schema } = mongoose;

const instagramSchedulePostSchema = new Schema({
    jobId: { type: String, required: true, unique: true },
    imgurImageUrl: { type: String, required: true },
    imgurDeleteHash: { type: String, required: true },
    caption: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    scheduledTime: { type: Date, required: true },
    status: {
        type: String,
        enum: ['scheduled', 'posted', 'failed'],
        default: 'scheduled'
    }
})

const InstagramScheduledPost = mongoose.model('InstagramScheduledPost', instagramSchedulePostSchema);
module.exports = InstagramScheduledPost;