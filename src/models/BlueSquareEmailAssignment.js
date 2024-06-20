const mongoose = require("mongoose");

const { Schema } = mongoose;

const BlueSquareEmailAssignmentSchema = new Schema({
  email: { type: String, required: true, unique: true },
  assignedTo: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true }
});

module.exports = mongoose.model("BlueSquareEmailAssignment", BlueSquareEmailAssignmentSchema, "BlueSquareEmailAssignments");