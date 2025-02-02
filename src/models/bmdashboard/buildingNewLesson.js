const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingNewLesson = new Schema({
    title: { type: String, required: true, maxLength: 20 },
    content: { type: String, required: true, maxLength: 500 },
    date: { type: Date, required: true, default: Date.now() },
    author: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    tags: [{ type: String, required: true, maxLength: 10 }],
    relatedProject: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject', required: true },
    likes: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'Like' }],
    totalLikes: { type: Number, default: 0 },
    allowedRoles: { type: String, required: true },
    files: [
        {
            data: Buffer,
            contentType: String,
            filename: String,
        },
    ],
});

buildingNewLesson.statics.getAllTags = async function() {
    const lessons = await this.find({}, 'tags');
    const allTags = lessons.reduce((acc, lesson) => [...acc, ...lesson.tags], []);
    return [...new Set(allTags)].sort();
};

module.exports = mongoose.model('buildingNewLesson', buildingNewLesson, 'buildingNewLessons');
