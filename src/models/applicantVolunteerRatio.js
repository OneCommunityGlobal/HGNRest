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
