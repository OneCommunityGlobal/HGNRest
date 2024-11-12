const mongoose = require('mongoose');
const { Schema } = mongoose;

const faqSchema = new Schema({
    question: { type: String, required: true },
    answer: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
});

module.exports = mongoose.model('FAQ', faqSchema, 'FAQs');
