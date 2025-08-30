const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true }

});

module.exports = mongoose.model("bidoverview_User", userSchema, "bidoverview_Users");