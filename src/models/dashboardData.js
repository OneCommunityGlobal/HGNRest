const mongoose = require('mongoose');

const { Schema } = mongoose;


const DashboardData = new Schema({
    dataId: {type: String},
    aIPromptText: { type: String, required: true},
});

module.exports = mongoose.model('dashboardData', DashboardData, 'dashboard');