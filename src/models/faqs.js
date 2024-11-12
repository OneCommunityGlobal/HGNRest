const mongoose = require('mongoose');
const { Schema } = mongoose;

const faqSchema = new Schema({
    question: { type: String, required: true },
    answer: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    changeHistory: [
        {
            modifiedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
            modifiedAt: { type: Date, default: Date.now },
            previousQuestion: String,
            previousAnswer: String,
        },
    ],
});

module.exports = mongoose.model('FAQ', faqSchema, 'FAQs');
