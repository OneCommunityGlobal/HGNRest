const mongoose = require('mongoose');

const { Schema } = mongoose;
const weeklySummariesFilter = new Schema(
  {
    filterName: String,
    selectedCodes: {
      type: [String],
      default: [],
    },
    selectedColors: {
      type: [String],
      default: [],
    },
    selectedExtraMembers: {
      type: [String],
      default: [],
    },
    selectedTrophies: Boolean,
    selectedSpecialColors: {
      purple: Boolean,
      green: Boolean,
      navy: Boolean,
    },
    selectedBioStatus: Boolean,
    selectedOverTime: Boolean,
  },
  { timestamps: true },
);

module.exports = mongoose.model('WeeklySummariesFilter', weeklySummariesFilter);
