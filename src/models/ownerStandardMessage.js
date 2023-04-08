const mongoose = require('mongoose');

const { Schema } = mongoose;

const OwnerStandardMessage = new Schema({
  message: { type: String },
});

module.exports = mongoose.model('ownerStandardMessage', OwnerStandardMessage, 'ownerStandardMessage');
