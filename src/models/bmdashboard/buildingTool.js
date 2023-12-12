const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingTool = new Schema({
    itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingInventoryType' },
    code: { type: Number, required: true }, // add function to create code for on-site tool tracking
    purchaseStatus: { type: String, enum: ['Rental', 'Purchase'], required: true },
    // add discriminator based on rental or purchase so these fields are required if tool is rented
    rentedOnDate: Date,
    rentalDue: Date,
    userResponsible: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    purchaseRecord: [{ // track purchase/rental requests
        _id: false, // do not add _id field to subdocument
        date: { type: Date, default: Date.now() },
        requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
        priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
        brand: String,
        status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
    }],
    updateRecord: [{ // track tool condition updates
        _id: false,
        date: { type: Date, default: Date.now() },
        createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
        condition: { type: String, enum: ['Good', 'Needs Repair', 'Out of Order'] },
    }],
    logRecord: [{ // track tool daily check in/out and use
        _id: false,
        date: { type: Date, default: Date.now() },
        createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
        responsibleUser: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
        type: { type: String, enum: ['Check In', 'Check Out'] }, // default = opposite of current log status?
    }],
});

module.exports = mongoose.model('buildingTool', buildingTool, 'buildingTools');
