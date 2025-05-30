const mongoose = require('mongoose');

const FilterCriteriaSchema = new mongoose.Schema(
  {
    startDate: {
      type: Date,
      required: false,
    },
    endDate: {
      type: Date,
      required: false,
    },
    roles: {
      type: [String],
      required: false,
    },
  },
  { _id: false },
); // Optional: _id can be disabled if it's a sub-document

module.exports = FilterCriteriaSchema;
