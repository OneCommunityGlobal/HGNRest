const mongoose = require('mongoose');

const jobsNotificationListSchema = new mongoose.Schema({
    email: { type: String, required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    category: { type: String, default: null },
});

jobsNotificationListSchema.index({ email: 1, jobId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('JobsNotificationList', jobsNotificationListSchema);
