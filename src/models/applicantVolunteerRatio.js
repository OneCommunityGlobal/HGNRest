const mongoose = require('mongoose');

const applicantVolunteerRatioSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
    },
    totalApplicants: {
      type: Number,
      required: true,
    },
    totalHired: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const ApplicantVolunteerRatio = mongoose.model(
  'ApplicantVolunteerRatio',
  applicantVolunteerRatioSchema,
);

module.exports = ApplicantVolunteerRatio;
