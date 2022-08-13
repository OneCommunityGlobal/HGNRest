const mongoose = require('mongoose');

const { Schema } = mongoose;

const timerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'userProfile' },
  pausedAt: { type: Number, default: 0 },
  seconds: { type: Number, default: 0 },
  isWorking: { type: Boolean, default: false },
  started: { type: Date },
  lastAccess: { type: Date },
});

module.exports = mongoose.model('timer', timerSchema, 'timers');
