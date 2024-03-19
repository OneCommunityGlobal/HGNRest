const mongoose = require("mongoose");

const { Schema } = mongoose;

const followUpSchema = new Schema({
  followUpCheck: {
    type: Boolean,
    default: false,
  },
  followUpPercentageDeadline: {
    type: Number,
    default: 0,
  },
  taskId: { type: mongoose.SchemaTypes.ObjectId, ref: "task", required: true },
  userId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: "userProfiles",
    required: true,
  }
});

module.exports = mongoose.model("followUp", followUpSchema, "followUps");
