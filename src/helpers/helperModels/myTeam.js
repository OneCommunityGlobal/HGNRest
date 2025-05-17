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
// Add index on the 'myteam._id' field to optimize lookups on team members
myTeamSchema.index({ 'myteam._id': 1 });
myTeamSchema.index({ 'myteam.role': 1 });
module.exports = mongoose.model('myTeam', myTeamSchema, 'myTeam');
