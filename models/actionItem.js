var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var actionItemSchema = new Schema({

    description: {type: String, required: true},
    assignedTo : {type: Schema.Types.ObjectId, ref: 'userProfile'},
    createdBy: {type: Schema.Types.ObjectId, ref: 'userProfile'},
    createdDateTime: {type: Date, default : new Date().toISOString()}
   
});

module.exports = mongoose.model('actionItem', actionItemSchema, 'actionItems');
