const mongoose = require('mongoose');

const { Schema } = mongoose;

const truthSocialPostHistorySchema = new Schema(
    {
        content: {
            type: String,
            required: true,
            maxlength: 500,
        },
        image: {
            type: String,
            default: null,
        },
        altText: {
            type: String,
            default: '',
            maxlength: 1000,
        },
        truthSocialPostId: {
            type: String,
            default: null,
        },
        postedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
truthSocialPostHistorySchema.index({ postedAt: -1 });

module.exports = mongoose.models.TruthSocialPostHistory || mongoose.model('TruthSocialPostHistory', truthSocialPostHistorySchema);