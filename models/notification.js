var mongoose = require('mongoose');
var eventtypes = require('../constants/eventTypes');
var Schema = mongoose.Schema;

var notificationSchema = new Schema({

    message: {type: String, required: true},
    recipient : {type: Schema.Types.ObjectId, ref: 'userProfile'},
    isRead: {type: Boolean, default : false},
    eventType: {type: String}
   
});

module.exports = mongoose.model('notification', notificationSchema, 'notifications');