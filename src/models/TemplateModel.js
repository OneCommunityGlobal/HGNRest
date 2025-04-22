// src/models/TemplateModel.js

const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      unique: true 
    },
    fields: [
      {
        questionText: { type: String, required: true },
        questionType: {
          type: String,
          required: true,
          enum: ["textbox", "textarea", "checkbox", "radio", "dropdown", "date"],
        },
        visible: { type: Boolean, default: true },
        isRequired: { type: Boolean, default: false },
        placeholder: { type: String },
        options: [String],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Template", templateSchema);