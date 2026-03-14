const express = require('express');
const recipeController = require('../../controllers/kitchenInventory/recipeController');

const routes = function () {
  const router = express.Router();
  const recipeCtrl = recipeController();

  router.route('/').get(recipeCtrl.getAllRecipes).post(recipeCtrl.createRecipe);
  router.route('/:recipeId').get(recipeCtrl.getRecipeById).delete(recipeCtrl.deleteRecipe);

  return router;
};

module.exports = routes;
