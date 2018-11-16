const mongoose = require('mongoose');

const { Schema } = mongoose;

const myManagerSchema = new Schema({

  _id: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  managers: [{ type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' }],

});

module.exports = mongoose.model('myManager', myManagerSchema, 'myManagers');
