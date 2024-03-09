/* eslint-disable quotes */
const mongoose = require("mongoose");

const { Schema } = mongoose;

const emailSubscriptionSchema = new Schema({
  email: { type: String, required: true, unique: true },
  emailSubscriptions: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("emailSubscriptions", emailSubscriptionSchema, "emailSubscriptions");