const mongoose = require('mongoose');

const { Schema } = mongoose;

const team = new Schema({
  teamName: { type: 'String', required: true },
  isActive: { type: 'Boolean', required: true, default: true },
  createdDatetime: { type: Date },
  modifiedDatetime: { type: Date, default: Date.now() },
  members: [
    {
      userId: { type: mongoose.SchemaTypes.ObjectId, required: true },
      addDateTime: { type: Date, default: Date.now(), ref: 'userProfile' },
    },
  ],
});

module.exports = mongoose.model('team', team, 'teams');
