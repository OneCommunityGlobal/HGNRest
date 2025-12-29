const mongoose = require("mongoose");

const EducatorSchema = new mongoose.Schema(
  {
    externalId: { type: String, index: true, unique: true, sparse: true },

    name: { type: String, required: true, index: true },
    subject: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Educator", EducatorSchema);
