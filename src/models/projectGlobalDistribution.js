const mongoose = require('mongoose');

const projectsGlobalDistributionSchema = new mongoose.Schema(
  {
    region: {
      type: String,
      required: true,
      enum: ['Asia', 'North America', 'Europe', 'South America', 'Africa', 'Middle East'],
    },
    status: {
      type: String,
      required: true,
      enum: ['Active', 'Delayed', 'Completed'],
    },
    date: {
      type: Date,
      required: true,
    },
    projectName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  'projectsglobaldistribution',
  projectsGlobalDistributionSchema,
  'projectsglobaldistribution',
);
