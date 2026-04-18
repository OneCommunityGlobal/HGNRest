const express = require('express');

const routes = function (KitchenRecipe) {
  const controller = require('../controllers/kitchenRecipeController')(KitchenRecipe);
  const kitchenRecipeRouter = express.Router();

  kitchenRecipeRouter.route('/kitchenandinventory/recipes').get(controller.getRecipes);

  kitchenRecipeRouter.route('/kitchenandinventory/recipes/:recipeId').get(controller.getRecipeById);

  kitchenRecipeRouter
    .route('/kitchenandinventory/recipes/:recipeId/substitute')
    .put(controller.substituteIngredient);

  return kitchenRecipeRouter;
};

module.exports = routes;
