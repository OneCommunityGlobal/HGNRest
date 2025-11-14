const mongoose = require('mongoose');

const { Schema } = mongoose;

const taskRubricSchema = new Schema({
  task_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'task',
    required: true,
  },
  rubric_json: {
    type: Schema.Types.Mixed,
    required: true,
    validate: {
      validator(v) {
        return v && typeof v === 'object' && v.criteria && v.weights && v.descriptions;
      },
      message: 'Rubric JSON must contain criteria, weights, and descriptions'
    }
  },
  created_at: {
    type: Date,
    default: Date.now,
    required: true,
  },
  updated_at: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

taskRubricSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

taskRubricSchema.index({ task_id: 1 });

module.exports = mongoose.model('TaskRubric', taskRubricSchema, 'taskRubrics');