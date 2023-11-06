const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectDetail = new Schema({
projectName: { type: String, required: true, unique: true },
tools: [{
 inventoryItemId: { type: Number, required: true },
 title: { type: String, required: true },
 image: { type: String, required: true },
 rentedOnDate: { type: Date, required: true },
 rentDuration: { type: String, required: true },
}],
materials: [{
 inventoryItemId: { type: Number, required: true },
 title: { type: String, required: true },
 image: { type: String, required: true },
 amountTotal: { type: Number, required: true },
 amountUsed: { type: Number, required: true },
}],
people: [{
 personId: { type: Number, required: true },
 personName: { type: String, required: true },
 personLastName: { type: String, required: true },
 role: { type: String, required: true },
 team: { type: String, required: true },
 currentTask: { type: String, required: true },
 totalHrs: { type: Number, required: true },
 todayHrs: { type: Number, required: true },
}],
});

module.exports = mongoose.model('projectDetail', projectDetail, 'projectDetail');