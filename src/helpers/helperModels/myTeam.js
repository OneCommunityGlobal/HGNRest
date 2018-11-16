const mongoose = require('mongoose');

const { Schema } = mongoose;

const myTeamSchema = new Schema({

  _id: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  myteam: [
    {
      _id: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      fullName: { type: String },
      role: { type: String },
    }],

});

module.exports = mongoose.model('myTeam', myTeamSchema, 'myTeam');
