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
      userId: { type: mongoose.SchemaTypes.ObjectId, required: true, index: true },
      addDateTime: { type: Date, default: Date.now(), ref: 'userProfile' },
      visible: { type: 'Boolean', default: true },
    },
  ],
  /**
   * Placement metadata for the Promotion Eligibility dashboard (doc item #23).
   *
   * All three are optional and default to null. A team missing any of them is
   * not a placement candidate, which is deliberate: it means the 1000+ teams
   * that already exist need no backfill, and only the real PR review teams
   * have to be configured. Nothing outside that dashboard reads these.
   *
   * `standupTime` is stored as typed ("11AM", "14:00") and parsed on read, and
   * is interpreted in `standupTimezone`, which defaults to Pacific because the
   * setup questionnaire asks for availability in Pacific.
   */
  hoursBand: {
    type: 'String',
    enum: ['10-19.99', '20+', null],
    default: null,
  },
  standupDay: {
    type: 'String',
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', null],
    default: null,
  },
  standupTime: { type: 'String', default: null },
  standupTimezone: { type: 'String', default: 'America/Los_Angeles' },

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
