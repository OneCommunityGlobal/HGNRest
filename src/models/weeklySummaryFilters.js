const mongoose = require('mongoose');

const { Schema } = mongoose;

const weeklySummaryFilters = new Schema({
      codes: [
        {
            value: { type: String, required: true }, 
            label: { type: String, required: true },
            _ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SomeModel' }] // Reference to another collection (optional)
        }
    ],
    colors: [{ type: String }], // Array of strings for colors
    filterName: { type: String, required: true },
    FilterByBioStatus: { type: Boolean, default: false },
    FilterByOverHours: { type: Boolean, default: false }
});

module.exports = mongoose.model('weeklySummaryFilters', weeklySummaryFilters, 'weeklySummaryFilters');
