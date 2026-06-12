const mongoose = require('mongoose');

<<<<<<< HEAD
const {Schema} = mongoose;
=======
const { Schema } = mongoose;
>>>>>>> origin/development

const helpCategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },

  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model('HelpCategory', helpCategorySchema, 'helpCategories');
