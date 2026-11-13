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

// Query-plan validated on disposable synthetic data; see requirements/bmNewLessonController/getLessons.md.
// Date order also serves oldest-first via a reverse scan. Tags is the only array key.
buildingNewLesson.index({ date: -1, _id: -1 }, { name: 'lesson_date_id', collation: { locale: 'simple' } });
buildingNewLesson.index({ tags: 1, date: -1, _id: -1 }, { name: 'lesson_tags_date_id', collation: { locale: 'simple' } });
buildingNewLesson.index({ totalLikes: -1, _id: -1 }, { name: 'lesson_likes_id', collation: { locale: 'simple' } });

buildingNewLesson.statics.getAllTags = async function() {
    const lessons = await this.find({}, 'tags');
    const allTags = lessons.reduce((acc, lesson) => [...acc, ...lesson.tags], []);
    return [...new Set(allTags)].sort();
};

module.exports = mongoose.model('buildingNewLesson', buildingNewLesson, 'buildingNewLessons');
