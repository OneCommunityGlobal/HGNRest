const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  page: { type: Number, required: true },
  title: { type: String, required: true },
});

module.exports = mongoose.model("Question", QuestionSchema);