/* eslint-disable quotes */
const mongoose = require("mongoose");

const { Schema } = mongoose;

const timerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: "userProfile" },
  startAt: { type: Date, default: Date.now },
  time: { type: Number, default: 900000 },
  goal: { type: Number, default: 900000 },
  paused: { type: Boolean, default: false },
  forcedPause: { type: Boolean, default: false },
  started: { type: Boolean, default: false },
});

module.exports = mongoose.model("newTimer", timerSchema, "newTimers");
