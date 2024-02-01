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
      visible: { type : 'Boolean', default:true},
    },
  ],
  teamCode: {
    type: 'String',
    default: '',
    validate: {
      validator(v) {
        const teamCoderegex = /^([a-zA-Z]-[a-zA-Z]{3}|[a-zA-Z]{5})$|^$/;
        return teamCoderegex.test(v);
      },
      message:
        'Please enter a code in the format of A-AAA or AAAAA',
    },
  },
});

module.exports = mongoose.model('team', team, 'teams');
