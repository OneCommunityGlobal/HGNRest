/* eslint-disable */
const { Schema } = require('mongoose');

const ExpenditureSchema = new Schema({
    projectId: {
        type: String,
        required: true,
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
        required: true,
    },
});

module.exports = require('mongoose').model('ExpenditureCost', ExpenditureSchema, 'expenditure');
