var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userFullNameSchema = new Schema({

    _id : {type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile'},
    fullName : {type:String}
   
});

module.exports = mongoose.model('userFullName', userFullNameSchema, 'userFullName');