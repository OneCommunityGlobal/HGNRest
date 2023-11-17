const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingTools = new Schema({
    inventoryItemId: { type: mongoose.SchemaTypes.ObjectId, ref: 'INVENTORY' }, // later ,INVENTORY needs to be changed as per inventory model
    title: { type: String, required: true },
    image: { type: String, required: true },
    rentedOnDate: { type: Date, required: true },
    rentDuration: { type: Number, required: true }, // This value should be taken in number of days
    total: {type: Number, required: true},
    availableCount:{type: Number, required: true},
    logInStatus:{Boolean},
    condition:{type: String, enum: ['Good', 'Needs Repair', 'Out of Order','Unused'], default: 'Condition'},
    userResponsible:{ type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    purchaseStatus:{type: String, enum: ['Rented', 'Purchased'], default: 'Status'},
});

module.exports = mongoose.model('buildingTools', buildingTools, 'buildingTools');