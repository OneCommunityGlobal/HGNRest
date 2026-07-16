const mongoose = require('mongoose');

const educationStudentProfileSchema = new mongoose.Schema(
  {},
  {
    collection: 'education_student_profiles',
    strict: false,
    timestamps: false,
  },
);

module.exports = mongoose.model('EducationStudentProfile', educationStudentProfileSchema);
