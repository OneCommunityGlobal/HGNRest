const mongoose = require('mongoose');
const moment = require('moment-timezone');

const { Schema } = mongoose;
const teamMember = new Schema({
  _id: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      fullName: { type: String },
      role: { type: String },


});
const summaryReceiver = new Schema({
  _id: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      fullName: { type: String },
      role: { type: String },
      email: { type: String, index: false },

});
const summaryGroup = new Schema({

  summaryGroupName: { type: 'String', required: true },
  isActive: { type: 'Boolean', required: false, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
  teamMembers: [teamMember],
  summaryReceivers: [summaryReceiver],
});

module.exports = mongoose.model('summaryGroup', summaryGroup, 'summaryGroups');
