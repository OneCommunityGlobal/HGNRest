const mongoose = require('mongoose');

const { Schema } = mongoose;

const timeOffRequest = new Schema({
  requestFor: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  reason: { type: 'String', required: true },
  startingDate: { type: Date, required: true },
  endingDate: { type: Date },
  duration: { type: Number, required: true } // in weeks

});

module.exports = mongoose.model('timeOffRequest', timeOffRequest, 'timeOffRequests');