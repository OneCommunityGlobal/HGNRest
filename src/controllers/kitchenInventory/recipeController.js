const mongoose = require('mongoose');
const Recipe = require('../../models/kitchenInventory/recipe');

const recipeController = function () {
  const createRecipe = async (req, res) => {
    try {
      const {
        name,
        type,
        description,
        instructions,
        timeToCook,
        servings,
        difficulty,
        ingredients,
        tags,
      } = req.body;

      if (
        !name ||
        !type ||
        !description ||
        !instructions ||
        !timeToCook ||
        !servings ||
        !difficulty
      ) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const recipe = new Recipe({
        name,
        type,
        description,
        instructions,
        timeToCook,
        servings,
        difficulty,
        ingredients: ingredients || [],
        tags: tags || [],
      });

      await recipe.save();

      return res.status(201).json(recipe);
    } catch (error) {
      return res.status(500).json(error);
    }
  };

  const getAllRecipes = async (req, res) => {
    try {
      const recipes = await Recipe.find().sort({ createdAt: -1 }).lean();

      return res.status(200).json(recipes);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const getRecipeById = async (req, res) => {
    try {
      const { recipeId } = req.params;
      const recipe = await Recipe.findById(recipeId).lean();

      if (!recipe) {
        return res.status(404).json({ message: 'Recipe Not Found' });
      }

      return res.status(200).json(recipe);
    } catch (error) {
      return res.status(500).json(error);
    }
  };

  const updateRecipe = async (req, res) => {
    const { recipeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(recipeId)) {
      return res.status(400).send('Invalid Recipe id');
    }

    try {
      const updatedRecipe = await Recipe.findByIdAndUpdate(recipeId, req.body, { new: true });
      if (!updatedRecipe) {
        return res.status(404).json('Recipe Not found');
      }
      res.status(200).json(updatedRecipe);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const deleteRecipe = async (req, res) => {
    try {
      const { recipeId } = req.params;

      const deletedRecipe = await Recipe.findByIdAndDelete(recipeId);

      if (!deletedRecipe) {
        return res.status(404).json({ message: 'Recipe Not Found' });
      }

      return res.status(200).json({ message: 'Recipe Deleted Successfully' });
    } catch (error) {
      return res.status(500).json(error);
    }
  };

  return {
    createRecipe,
    getAllRecipes,
    getRecipeById,
    updateRecipe,
    deleteRecipe,
  };
};

module.exports = recipeController;
