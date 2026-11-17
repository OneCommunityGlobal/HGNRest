const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectCostTrackingSchema = new Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // Was 'Project' (the unrelated general org-project collection: "HG Education",
    // "Sid Project", etc.) — these entries are actually keyed to BM Dashboard
    // construction projects (Building 1, 2, 3, ...), which live in buildingProjects.
    ref: 'buildingProject',
  },
  date: {
    type: Date,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Labor', 'Materials', 'Equipment'],
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
  },
  // No real planned-budget source exists yet for these entries, so this stays null
  // rather than being backfilled with an estimate. Once real budget data exists,
  // it belongs here.
  plannedCost: {
    type: Number,
    default: null,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient querying
projectCostTrackingSchema.index({ projectId: 1, date: 1, category: 1 });

// Update updatedAt on save
projectCostTrackingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model(
  'ProjectCostTracking',
  projectCostTrackingSchema,
  'projectCostTracking',
);
