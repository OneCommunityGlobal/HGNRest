const mongoose = require('mongoose');

const { Schema } = mongoose;

const animalSchema = new Schema({
  name: { type: String, required: true },
  breed: { type: String },
  count: { type: Number, required: true, min: 1 },
  purpose: { type: String },
  location: { type: String, required: true },
  health: {
    type: String,
    enum: ['Healthy', 'Sick', 'Injured', 'Recovering'],
    default: 'Healthy',
  },
  acquiredDate: { type: Date },
  species: { type: String },
  notes: { type: String },
  vaccinations: [
    {
      name: String,
      date: Date,
      nextDue: Date,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('animal', animalSchema, 'animals');
