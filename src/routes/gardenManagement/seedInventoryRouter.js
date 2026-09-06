const express = require('express');
const {
  getSeedInventory,
  getSeedInventoryById,
  createSeedInventory,
  updateSeedInventory,
  deleteSeedInventory,
  updateSeedQuantity,
} = require('../../controllers/gardenManagement/seedInventoryController');

const router = express.Router();

/**
 * GET all seed inventory
 * GET /api/kitchenandinventory/gardenmanagement/seeds
 */
router.get('/', getSeedInventory);

/**
 * GET seed inventory by ID
 * GET /api/kitchenandinventory/gardenmanagement/seeds/:id
 */
router.get('/:id', getSeedInventoryById);

/**
 * CREATE seed inventory
 * POST /api/kitchenandinventory/gardenmanagement/seeds
 */
router.post('/', createSeedInventory);

/**
 * UPDATE seed inventory
 * PUT /api/kitchenandinventory/gardenmanagement/seeds/:id
 */
router.put('/:id', updateSeedInventory);

/**
 * DELETE seed inventory
 * DELETE /api/kitchenandinventory/gardenmanagement/seeds/:id
 */
router.delete('/:id', deleteSeedInventory);

/**
 * UPDATE seed quantity
 * PATCH /api/kitchenandinventory/gardenmanagement/seeds/:id/quantity
 */
router.patch('/:id/quantity', updateSeedQuantity);

module.exports = router;
