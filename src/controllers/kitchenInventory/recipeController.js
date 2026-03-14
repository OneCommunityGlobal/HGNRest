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
    deleteRecipe,
  };
};

module.exports = recipeController;
