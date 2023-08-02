const mongoose = require('mongoose');

const { Schema } = mongoose;

const mouseoverText = new Schema({
    mouseoverText: { type: String },
});

module.exports = mongoose.model('mouseoverText', mouseoverText, 'mouseoverText');