const mongoose = require('mongoose');

const userTaskSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['student', 'educator'], required: true },
});

module.exports = mongoose.model('UserTask', userTaskSchema, 'usertask');
