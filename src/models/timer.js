/* eslint-disable quotes */
const mongoose = require("mongoose");

const { Schema } = mongoose;

const timerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: "userProfile" },
  lastAccess: { type: Date, default: Date.now },
  time: { type: Number, default: 900000 },
  countdown: { type: Boolean, default: true },
  goal: { type: Number, default: 0 },
  paused: { type: Boolean, default: true },
  forcedPause: { type: Boolean, default: false },
  stopped: { type: Boolean, default: false },
});

module.exports = mongoose.model("newTimer", timerSchema, "newTimers");
