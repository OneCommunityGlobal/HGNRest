const mongoose = require('mongoose');
const { Schema } = mongoose;

const faqSchema = new Schema({
    question: { type: String, required: true },
    answer: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    changeHistory: [
        {
            updatedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
            updatedAt: { type: Date, default: Date.now },
            previousQuestion: String,
            previousAnswer: String,
            updatedQuestion: String,
            updatedAnswer: String,
        },
    ],
});

module.exports = mongoose.model('FAQ', faqSchema, 'FAQs');
