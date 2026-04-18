const kitchenRecipeController = function (KitchenRecipe) {
  const getRecipes = function (req, res) {
    KitchenRecipe.find()
      .then((recipes) => {
        res.status(200).send(recipes);
      })
      .catch((error) => {
        res.status(500).send({ message: error.message || 'Error fetching recipes' });
      });
  };

  const getRecipeById = function (req, res) {
    const { recipeId } = req.params;
    KitchenRecipe.findById(recipeId)
      .then((recipe) => {
        if (!recipe) {
          return res.status(404).send({ message: 'Recipe not found' });
        }
        return res.status(200).send(recipe);
      })
      .catch((error) => {
        res.status(500).send({ message: error.message || 'Error fetching recipe' });
      });
  };

  const substituteIngredient = function (req, res) {
    const { recipeId } = req.params;
    const { ingredientId, substituteName, quantity } = req.body;

    if (!ingredientId || !substituteName || !quantity) {
      return res.status(400).send({
        message: 'ingredientId, substituteName, and quantity are required',
      });
    }

    return KitchenRecipe.findById(recipeId)
      .then((recipe) => {
        if (!recipe) {
          return res.status(404).send({ message: 'Recipe not found' });
        }

        const ingredient = recipe.ingredients.id(ingredientId);
        if (!ingredient) {
          return res.status(404).send({ message: 'Ingredient not found in recipe' });
        }

        ingredient.name = substituteName;
        ingredient.quantity = quantity;
        ingredient.isAvailable = true;
        recipe.updatedAt = Date.now();

        return recipe.save().then((updatedRecipe) => {
          res.status(200).send({
            message: 'Ingredient substituted',
            recipe: updatedRecipe,
          });
        });
      })
      .catch((error) => {
        res.status(500).send({ message: error.message || 'Error substituting ingredient' });
      });
  };

  return {
    getRecipes,
    getRecipeById,
    substituteIngredient,
  };
};

module.exports = kitchenRecipeController;
