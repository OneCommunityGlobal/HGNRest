const mongoose = require("mongoose")

const { Schema } = mongoose
const laborCostSchema = new Schema({
  project_name: {
    type: String,
    required: true,
    index: true,
  },
  task: {
    type: String,
    required: true,
  },
  cost: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
})

// Create compound indexes for better query performance
laborCostSchema.index({ project_name: 1, date: -1 })
laborCostSchema.index({ project_name: 1, task: 1 })

module.exports = mongoose.model("LaborCost", laborCostSchema)
