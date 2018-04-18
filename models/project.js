var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var projectschema = new Schema({

    projectName: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    createdDatetime: { type: Date },
    modifiedDatetime: { type: Date, default: Date.now() }

});

module.exports = mongoose.model('project', projectschema, 'projects');
