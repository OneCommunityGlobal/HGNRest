const mongoose = require('mongoose');

const rolePledgeSchema = new mongoose.Schema(
  {
    role: String,
    monthsPledged: Number,
    pledgeDate: Date,
  },
  { collection: 'RolePledges' },
);

module.exports = mongoose.model('rolePledge', rolePledgeSchema);
