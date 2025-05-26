// const { file } = require('googleapis/build/src/apis/file');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const imgurScheduledPostsSchema = new Schema ({
    jobId: { type: String, required: true, unique: true },
    imageHash: { type: String, required: true },
    imageUrl: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: { type: String, required: true },
    topic: { type: String, required: true },
    deleteHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    scheduledTime: { type: Date, required: true },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'failed'],
        default: 'scheduled',
    }
});

const ImgurScheduledPost = mongoose.model('ImgurScheduledPost', imgurScheduledPostsSchema);

module.exports = ImgurScheduledPost;