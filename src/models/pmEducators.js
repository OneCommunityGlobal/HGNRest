const mongoose = require("mongoose");

const EducatorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    subject: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Educator", EducatorSchema);
