const mongoose = require('mongoose');

const { Schema } = mongoose;
const costSchema = new Schema({
    amount: {
        type: Number,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
    }
});

costSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('Cost', costSchema);
