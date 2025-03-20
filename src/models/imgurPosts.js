// const { file } = require('googleapis/build/src/apis/file');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const imgurScheduledPostsSchema = new Schema ({
    jobId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    tags: { type: String, required: true },
    topic: {type: String, required: false},
    files: [{
        imageHash: { type: String, required: true },
        originalName: { type: String, required: true },
        description: { type: String, required: true },
    }],
    uploadedTime: { type: Date, default: Date.now },
    scheduleTime: { type: Date, required: true },
});

const ImgurScheduledPost = mongoose.model('ImgurScheduledPost', imgurScheduledPostsSchema);

module.exports = ImgurScheduledPost;