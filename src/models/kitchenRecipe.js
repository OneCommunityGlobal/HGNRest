const mongoose = require('mongoose');

const { Schema } = mongoose;

const ingredientSchema = new Schema({
  name: { type: String, required: true },
  quantity: { type: String, required: true },
  isOnsite: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
});

const kitchenRecipeSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String },
  prepTime: { type: Number },
  servings: { type: Number },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
  tags: [{ type: String }],
  hasPriorityIngredients: { type: Boolean, default: false },
  onsitePercentage: { type: Number, default: 0 },
  ingredients: [ingredientSchema],
  instructions: [{ type: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('kitchenRecipe', kitchenRecipeSchema, 'kitchenRecipes');
