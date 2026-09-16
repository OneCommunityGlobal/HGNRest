const mongoose = require('mongoose');

const studentTaskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  due_date: { type: Date },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StudentTask', studentTaskSchema, 'studenttask');
