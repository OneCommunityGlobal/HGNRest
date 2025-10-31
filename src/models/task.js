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

      userID: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      profilePic: { type: String },
      completedTask: { type: Boolean, default: false },
      reviewStatus: { type: String, default: 'Unsubmitted' },
    },
  ],
  isAssigned: { type: Boolean, default: true },
  status: { type: String, default: 'Not Started' },
  hoursBest: { type: Number, default: 0.0 },
  hoursWorst: { type: Number, default: 0.0 },
  hoursMost: { type: Number, default: 0.0 },
  hoursLogged: { type: Number, default: 0.0 },
  estimatedHours: { type: Number, default: 0.0 },
  startedDatetime: { type: Date },
  dueDatetime: { type: Date },
  links: [String],
  relatedWorkLinks: [String],
  category: { type: String },
  deadlineCount: { type: Number, default: 0.0 },
  parentId1: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  parentId2: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  parentId3: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  mother: { type: mongoose.SchemaTypes.ObjectId, ref: 'task', default: null },
  position: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  hasChild: { type: Boolean, default: false },
  childrenQty: { type: Number, default: 0, required: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
  createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }, // <-- add this
  whyInfo: { type: String },
  intentInfo: { type: String },
  endstateInfo: { type: String },
  classification: { type: String },
});

module.exports = mongoose.model('task', taskschema, 'tasks');
