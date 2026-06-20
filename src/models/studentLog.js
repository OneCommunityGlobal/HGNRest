const mongoose = require('mongoose');

const StudentLogSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true 
    },
    date: {
        type: Date,
        required: true
    },
    log: {
        type: String,
        required: true
    },  
})

module.exports = mongoose.model('StudentLog', StudentLogSchema);

