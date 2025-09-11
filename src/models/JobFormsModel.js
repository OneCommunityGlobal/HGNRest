const mongoose = require('mongoose');

const formSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      default: 'General',
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

    // Fixed fields that always appear
    fixedFields: {
      includePersonalInfo: { type: Boolean, default: true }, // Name, Email, Phone
      includeBasicInfo: { type: Boolean, default: true }, // Title, Location
      includeExperience: { type: Boolean, default: true }, // Experience level
      includeAvailability: { type: Boolean, default: true }, // Start date, hours/week
    },

    // Optional job links
    jobLinks: {
      specificJobLink: { type: String, default: '' }, // Ad-specific link
      generalLinks: [
        {
          title: String,
          url: String,
          description: String,
        },
      ], // 2-5 general links
    },

    // Custom questions for this specific form
    questions: [
      {
        questionText: { type: String, required: true },
        visible: { type: Boolean, required: true, default: true },
        questionType: {
          type: String,
          required: true,
          enum: ['textbox', 'textarea', 'checkbox', 'radio', 'dropdown', 'date', 'file'],
        },
        isRequired: { type: Boolean, default: false },
        options: [String],
        placeholder: { type: String, default: '' },
        validationRules: {
          minLength: { type: Number },
          maxLength: { type: Number },
          pattern: { type: String },
          fileTypes: [String],
        },
        fromQuestionSet: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'QuestionSet',
          default: null,
        },
      },
    ],

    // References to reusable question sets used in this form
    questionSets: [
      {
        questionSetId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'QuestionSet',
          required: true,
        },
        includeAll: { type: Boolean, default: true },
        selectedQuestions: [Number], // Indices of selected questions if not including all
      },
    ],

    // Form settings
    settings: {
      allowDuplicateSubmissions: { type: Boolean, default: false },
      requireLogin: { type: Boolean, default: false },
      autoSaveProgress: { type: Boolean, default: true },
      showProgressBar: { type: Boolean, default: true },
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
    },
    isActive: { type: Boolean, default: true },
    isTemplate: { type: Boolean, default: false }, // Can be used as a template
    submissionCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index for better performance
formSchema.index({ category: 1, isActive: 1 });
formSchema.index({ createdBy: 1 });
formSchema.index({ isTemplate: 1 });

module.exports = mongoose.model('JobForms', formSchema);
