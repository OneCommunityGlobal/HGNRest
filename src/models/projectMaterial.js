const mongoose = require('mongoose');

const projectMaterialSchema = new mongoose.Schema({
    projectId: {
        type: String,
        required: true,
        unique: true
    },
    project: {
        type: Date,
        required: true,
    },
    tool: {
        type: String,
        required: true,
    },
    inUse: {
        type: Number, 
        required: true
    },
    needsReplacement: {
        type: Number, 
        required: true
    },
    yetToReceive:{
        type: Number, 
        required: true
    }
})

module.exports = mongoose.model('ExpenditureCost', projectMaterialSchema, 'expenditure');