const mongoose = require('mongoose');
const { Schema } = mongoose;

const unansweredFaqsSchema = new Schema({
    question: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
});

module.exports = mongoose.model('UnansweredFAQ', unansweredFaqsSchema, 'UnansweredFAQs');