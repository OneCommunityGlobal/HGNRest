const mongoose = require('mongoose');

const ExpenditureSchema = new mongoose.Schema({
    projectId: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    cost: {
        type: Number, 
        required: true
    }
})

module.exports = mongoose.model('ExpenditureCost', ExpenditureSchema, 'expenditure');