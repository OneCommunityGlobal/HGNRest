var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var myManagerSchema = new Schema({

    _id : {type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile'},
    managers : [{type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile'}]
   
});

module.exports = mongoose.model('myManager', myManagerSchema, 'myManagers');
