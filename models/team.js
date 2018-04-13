var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var team = new Schema({

    teamName: { type: "String", required: true },
    createdDatetime: { type: Date },
    modifiedDatetime: { type: Date, default: Date.now() }

});

module.exports = mongoose.model('team', team, 'teams');