const mongoose = require('mongoose');

const ProjectStatusSchema = new mongoose.Schema({
    name: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Active', 'Completed', 'Delayed'], 
        required: true 
    },
    startDate: { type: Date, required: true },
    completionDate: { type: Date }, // Optional, only needed when project is completed
});

module.exports = mongoose.model('ProjectStatus', ProjectStatusSchema, 'projectStatus');
