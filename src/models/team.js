const mongoose = require('mongoose');

const { Schema } = mongoose;

const team = new Schema({
  teamName: { type: 'String', required: true },
  isActive: { type: 'Boolean', required: true, default: true },
  createdDatetime: { type: Date, default: Date.now() },
  modifiedDatetime: { type: Date, default: Date.now() },
  members: [
    {
      userId: { type: mongoose.SchemaTypes.ObjectId, required: true },
      addDateTime: { type: Date, default: Date.now(), ref: 'userProfile' },
    },
  ],
  teamCode: {
    type: 'String',
    default: '',
    validate: {
      validator(v) {
        const teamCoderegex = /^([a-zA-Z0-9]-[a-zA-Z0-9]{3,5}|[a-zA-Z0-9]{5,7})|^$/;
        return teamCoderegex.test(v);
      },
      message:
        'Please enter a code in the format of A-AAAA or AAAAA, with optional numbers, and a total length between 5 and 7 characters.',
    },
  },
});

module.exports = mongoose.model('team', team, 'teams');
