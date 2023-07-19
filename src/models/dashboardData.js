const mongoose = require('mongoose');

const { Schema } = mongoose;


const DashboardData = new Schema({
    _id: { type: mongoose.Schema.Types.String },
    aIPromptText: { type: String },
});

module.exports = mongoose.model('dashboardData', DashboardData, 'dashboard');
