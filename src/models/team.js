const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * This schema represents a team in the system.
 *
 * Deprecated field: teamCode. Team code is no longer associated with a team.
 * Team code is used as a text string identifier in the user profile data model.
 */
const team = new Schema({
  teamName: { type: 'String', required: true },
  isActive: { type: 'Boolean', required: true, default: true },
  createdDatetime: { type: Date, default: Date.now() },
  modifiedDatetime: { type: Date, default: Date.now() },
  members: [
    {
      userId: { type: mongoose.SchemaTypes.ObjectId, required: true, index : true },
      addDateTime: { type: Date, default: Date.now(), ref: 'userProfile' },
      visible: { type : 'Boolean', default:true},

    },
  ],
  // Deprecated field
  teamCode: {
    type: 'String',
    default: '',
    validate: {
      validator(v) {
        const teamCoderegex = /^(.{5,7}|^$)$/;
        return teamCoderegex.test(v);
      },
      message:
        'Please enter a code in the format of A-AAAA or AAAAA, with optional numbers, and a total length between 5 and 7 characters.',
    },
  },
});


module.exports = mongoose.model('team', team, 'teams');
