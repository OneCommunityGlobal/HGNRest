const mongoose = require("mongoose");
const formSchema = new mongoose.Schema(
    {
      title: { type: String, required: true },
      description: { type: String, default: "" },
      questions: [
        {
          questionText: { type: String, required: true },
          visible:{type:Boolean,required:true},
          questionType: {
            type: String,
            required: true,
            enum: ["textbox", "textarea", "checkbox", "radio", "dropdown","date"],
          },
          isRequired: { type: Boolean, default: false },
          options: [String],
        },
      ],
    },
    { timestamps: true } // Automatically adds `createdAt` and `updatedAt`
  );
  
  module.exports= mongoose.model("JobForms", formSchema);
  