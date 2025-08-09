const mongoose = require('mongoose');

const { Schema } = mongoose;

const questionSetSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
      enum: [
        'General',
        'Engineering',
        'Marketing',
        'Design',
        'Management',
        'Data Analysis',
        'Content Creation',
        'Business Development',
        'Other',
      ],
    },
    targetRole: {
      type: String,
      default: 'General', // Can be used for role-specific question sets
    },
    questions: [
      {
        questionText: {
          type: String,
          required: true,
        },
        questionType: {
          type: String,
          required: true,
          enum: ['textbox', 'textarea', 'checkbox', 'radio', 'dropdown', 'date', 'file'],
        },
        isRequired: {
          type: Boolean,
          default: false,
        },
        options: [String], // For checkbox, radio, dropdown
        placeholder: {
          type: String,
          default: '',
        },
        validationRules: {
          minLength: { type: Number },
          maxLength: { type: Number },
          pattern: { type: String }, // regex pattern
          fileTypes: [String], // for file uploads
        },
      },
    ],
    isDefault: {
      type: Boolean,
      default: false, // Mark as default question set
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'userProfile',
    },
    usageCount: {
      type: Number,
      default: 0, // Track how many forms use this question set
    },
  },
  {
    timestamps: true,
  },
);

// Index for better query performance
questionSetSchema.index({ category: 1, targetRole: 1 });
questionSetSchema.index({ createdBy: 1 });
questionSetSchema.index({ isActive: 1, isDefault: 1 });

module.exports = mongoose.model('QuestionSet', questionSetSchema);
