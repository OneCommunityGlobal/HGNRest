const mongoose = require('mongoose');
const { v4: uuidv4, validate: isUUID } = require('uuid');

const activityLogSchema = new mongoose.Schema(
  {
    log_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
    },
    action_type: {
      type: String,
      enum: ['comment', 'note', 'announcement', 'task_upload', 'task_complete'],
      required: true,
    },
    entity_id: {
      type: String,
      required: true,
      default() {
        return uuidv4();
      },
      validate: {
        validator(v) {
          return isUUID(v);
        },
        message(props) {
          return `${props.value} is not a valid UUID!`;
        },
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'ActivityLog',
    versionKey: false,
  },
);

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;
