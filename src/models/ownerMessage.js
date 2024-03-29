const mongoose = require('mongoose');

const { Schema } = mongoose;

const OwnerMessage = new Schema({
  message: { type: String, default: '' },
  standardMessage: { type: String, default: '' },
});

module.exports = mongoose.model('ownerMessage', OwnerMessage, 'ownerMessage');
