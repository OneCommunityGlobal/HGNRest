const mongoose = require("mongoose");

const { Schema } = mongoose;

const WeeklySummaryEmailAssignmentSchema = new Schema({
  email: { type: String, required: true, unique: true },
  assignedTo: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true }
});

module.exports = mongoose.model(
  "WeeklySummaryEmailAssignment",
  WeeklySummaryEmailAssignmentSchema,
  "WeeklySummaryEmailAssignments" // 晚点检查数据库中是否正确创建
);
