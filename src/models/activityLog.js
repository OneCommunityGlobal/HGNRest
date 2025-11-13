const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
          return uuidRegex.test(v);
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
    is_assisted: {
      type: Boolean,
      default: false,
    },
    assisted_users: {
      type: [
        {
          user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'UserProfile',
            required: true,
          },
          name: {
            type: String,
            required: true,
          },
          assisted_at: {
            type: Date,
            default: Date.now,
          },
          assistance_type: {
            type: String,
            enum: ['created', 'edited'],
            default: 'edited',
          },
          _id: false,
        },
      ],
      default: null,
    },
  },
  {
    collection: 'ActivityLog',
    versionKey: false,
  },
);

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;
