const express = require('express');

const router = express.Router();
const {
  listCatalog,
  createCatalog,
  reorderCatalog,
  updateCatalog,
  getUserSelections,
  setUserSelections,
} = require('../controllers/userStateController');

// Catalog routes
router.get('/catalog', listCatalog);
router.post('/catalog', createCatalog);
router.put('/catalog/reorder', reorderCatalog);
router.patch('/catalog/:key', updateCatalog);

// User selection routes
router.get('/selection/:userId', getUserSelections);
router.put('/selection/:userId', setUserSelections);

module.exports = router;
