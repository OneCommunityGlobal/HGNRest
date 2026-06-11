const express = require('express');
const seedController = require('../../controllers/kitchenInventory/seedController');
const treesAndBushesController = require('../../controllers/kitchenInventory/treeAndBushController');
const animalController = require('../../controllers/kitchenInventory/animalController');

const routes = function (seed, treeAndBush, animal) {
  const router = express.Router();

  const seedCtrl = seedController();
  const treeAndBushCtrl = treesAndBushesController();
  const animalCtrl = animalController();

  // Seeds routes
  router.route('/seeds').get(seedCtrl.getAllSeeds).post(seedCtrl.createSeed);

  router
    .route('/seeds/:seedId')
    .get(seedCtrl.getSeedById)
    .put(seedCtrl.updateSeed)
    .delete(seedCtrl.deleteSeed);

  // Trees and Bushes routes
  router
    .route('/treesandbushes')
    .get(treeAndBushCtrl.getAllTreesAndBushes)
    .post(treeAndBushCtrl.createTreesAndBushes);

  router
    .route('/treesandbushes/:treeAndBushesId')
    .get(treeAndBushCtrl.getTreeAndBushesById)
    .put(treeAndBushCtrl.updateTreesAndBushes)
    .delete(treeAndBushCtrl.deleteTreesAndBushes);

  // Animals routes
  router.route('/animals').get(animalCtrl.getAllAnimals).post(animalCtrl.createAnimal);

  router
    .route('/animals/:animalId')
    .get(animalCtrl.getAnimalById)
    .put(animalCtrl.updateAnimal)
    .delete(animalCtrl.deleteAnimal);

  return router;
};

module.exports = routes;
