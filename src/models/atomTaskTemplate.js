import mongoose from 'mongoose';

const AtomTaskTemplateSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },

    atomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Atom',
      required: true,
    },

    taskType: {
      type: String,
      required: true,
      trim: true,
    },

    instructions: {
      type: String,
      required: true,
      trim: true,
    },

    resources: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export default mongoose.model('AtomTaskTemplate', AtomTaskTemplateSchema);
