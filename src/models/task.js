const mongoose = require('mongoose');

const { Schema } = mongoose;

const taskschema = new Schema({

  taskName: { type: String, required: true },
  wbsId: { type: mongoose.SchemaTypes.ObjectId, ref: 'wbs', required: true },
  num: { type: String, required: true },
  level: { type: Number, required: true },
  priority: { type: String, default: 'Primary' },
  resources: [
    {
      name: { type: String, required: true },
      userID: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfiles' },
      profilePic: { type: String },
    }],
  isAssigned: { type: Boolean, default: true },
  status: { type: String, default: 'Not Started' },
  hoursBest: { type: Number, default: 0.0 },
  hoursWorst: { type: Number, default: 0.0 },
  hoursMost: { type: Number, default: 0.0 },
  estimatedHours: { type: Number, default: 0.0 },
  startedDatetime: { type: Date },
  dueDatetime: { type: Date },
  links: [String],
  parentId1: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  parentId2: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  parentId3: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  mother: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  position: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },

});

module.exports = mongoose.model('task', taskschema, 'tasks');
