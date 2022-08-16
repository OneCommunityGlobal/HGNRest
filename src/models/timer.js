const mongoose = require('mongoose');

const { Schema } = mongoose;

const timerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'userProfile' },
  totalSeconds: { type: Number, default: 0 },
  isRunning: { type: Boolean, default: false },
  isUserPaused: { type: Boolean, default: false },
  isApplicationPaused: { type: Boolean, default: false },
});

module.exports = mongoose.model('timer', timerSchema, 'timers');
