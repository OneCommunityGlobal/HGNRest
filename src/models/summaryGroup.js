const mongoose = require('mongoose');

const { Schema } = mongoose;

const summaryGroup = new Schema({

  summaryGroupName: { type: 'String', required: true },
  isActive: { type: 'Boolean', required: false, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
});

module.exports = mongoose.model('summaryGroup', summaryGroup, 'summaryGroups');
