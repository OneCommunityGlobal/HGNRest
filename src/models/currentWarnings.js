const mongoose = require("mongoose");
const { Schema } = mongoose;

const currentWarnings = new Schema({
  warnings: [{ type: String, required: true }],
});

module.exports = mongoose.model(
  "currentWarning",
  currentWarnings,
  "currentWarnings"
);
