const express = require('express');
const {
  getSeedOrders,
  getSeedOrderById,
  createSeedOrder,
  updateSeedOrder,
  deleteSeedOrder,
  updateSeedOrderStatus,
} = require('../../controllers/gardenManagement/seedOrderController');

const router = express.Router();

/**
 * GET all seed orders
 * GET /api/kitchenandinventory/gardenmanagement/seed-orders
 */
router.get('/', getSeedOrders);

/**
 * GET seed order by ID
 * GET /api/kitchenandinventory/gardenmanagement/seed-orders/:id
 */
router.get('/:id', getSeedOrderById);

/**
 * CREATE seed order
 * POST /api/kitchenandinventory/gardenmanagement/seed-orders
 */
router.post('/', createSeedOrder);

/**
 * UPDATE seed order
 * PUT /api/kitchenandinventory/gardenmanagement/seed-orders/:id
 */
router.put('/:id', updateSeedOrder);

/**
 * DELETE seed order
 * DELETE /api/kitchenandinventory/gardenmanagement/seed-orders/:id
 */
router.delete('/:id', deleteSeedOrder);

/**
 * UPDATE seed order status
 * PATCH /api/kitchenandinventory/gardenmanagement/seed-orders/:id/status
 */
router.patch('/:id/status', updateSeedOrderStatus);

module.exports = router;
