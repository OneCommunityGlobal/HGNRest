const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    grade: { type: String, required: true },
    progress: { type: Number, default: 0 },
    educator: { type: mongoose.Schema.Types.ObjectId, ref: "Educator", required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", StudentSchema);
