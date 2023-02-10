const mongoose = require('mongoose');

const { Schema } = mongoose;


const OwnerMessage = new Schema({
  message: { type: String, required: true },
});

module.exports = mongoose.model('ownerMessage', OwnerMessage, 'ownerMessage');
