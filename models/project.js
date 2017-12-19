var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var projectschema = new Schema({

    projectName: {type: String, required: true},
    isActive : {type: Boolean, default: true},
    tasks : [{Description: {type: String, required: true}}],
    createdDatetime : {type: Date},
    modifiedDatetime : {type: Date, default: Date.now()}

});

module.exports = mongoose.model('project', projectschema, 'allProjects');
