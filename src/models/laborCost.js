const mongoose = require("mongoose")

const { Schema } = mongoose
const laborCostSchema = new Schema({
  project_name: {
    type: String,
    required: true
  },
  task: {
    type: String,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
}, {
    timestamps: true
})

module.exports = mongoose.model("LaborCost", laborCostSchema)

