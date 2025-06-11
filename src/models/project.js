const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectschema = new Schema({
  projectName: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
  membersModifiedDatetime: { type: Date, default: Date.now() },
  inventoryModifiedDatetime: { type: Date, default: Date.now() },
  category: {
    type: String,
    enum: [
      'Food',
      'Energy',
      'Housing',
      'Education',
      'Society',
      'Economics',
      'Stewardship',
      'Other',
      'Unspecified',
    ],
    default: 'Other',
  },
});

module.exports = mongoose.model('project', projectschema, 'projects');
