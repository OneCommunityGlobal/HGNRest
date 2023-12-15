const mongoose = require('mongoose');

const { Schema } = mongoose;

const LessonList = new Schema({
    title: { type: String, required: true, maxLength: 20 },
    content: { type: String, required: true, maxLength: 500 },
    date: { type: Date, required: true, default: Date.now() },
    author: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
    tag: [{ type: String, required: true, maxLength: 10 }],
    relatedProject: { type: mongoose.SchemaTypes.ObjectId, ref: 'project', required: true },
    likes: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'Like' }],
    totalLikes: { type: Number, default: 0 },

});

module.exports = mongoose.model('lessonList', LessonList);