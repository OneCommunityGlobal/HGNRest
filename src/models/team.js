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
        // RegEx check to validate the team code or if the team creation is from the Teams page, a '' value
        const teamCoderegex = /^([a-zA-Z]-[a-zA-Z]{3}|[a-zA-Z]{5})?$/;
        return teamCoderegex.test(v);
      },
      message:
        'Please enter a code in the format of A-AAA or AAAAA',
    },
  },
});

module.exports = mongoose.model('team', team, 'teams');
