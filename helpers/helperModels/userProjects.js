var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var taskSchema = new Schema({

    _id : {type: mongoose.SchemaTypes.ObjectId},
    Description : {type : String}

});

var ProjectSchema = new Schema({

    projectId : {type: mongoose.SchemaTypes.ObjectId, ref : "allProjects"},
    projectName : {type : String},
    tasks : [taskSchema]

});



var userProjectSchema = new Schema({

    _id : {type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile'},
    projects : [ProjectSchema]
   
});

module.exports = mongoose.model('userProject', userProjectSchema, 'userProjects');