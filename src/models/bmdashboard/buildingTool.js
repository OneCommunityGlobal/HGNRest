const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingTools = new Schema({
    itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingInventoryType' },
    title: { type: String, required: true },
    rentedOnDate: { type: Date, required: true },
    rentDuration: { type: Number, required: true }, // This value should be taken in number of days
    logInStatus:{Boolean},
    condition:{type: String, enum: ['Good', 'Needs Repair', 'Out of Order','Unused'], default: 'Good'},
    userResponsible:{ type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
    purchaseStatus:{type: String, enum: ['Rented', 'Purchased'], default: 'Rented'},
});

module.exports = mongoose.model('buildingTools', buildingTools, 'buildingTools');