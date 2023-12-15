const mongoose = require('mongoose');

const { Schema } = mongoose;
const LikeSchema = new Schema({
    user: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile', required: true },
   lesson: { type: mongoose.SchemaTypes.ObjectId, ref: 'lessonList', required: true },
  });
  
  module.exports = mongoose.model('Like', LikeSchema);