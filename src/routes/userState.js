const express = require('express');
const {
  listCatalog,
  createCatalog,
  reorderCatalog,
  updateCatalog,
  getUserSelections,
  setUserSelections,
} = require('../controllers/userStateController');

const router = express.Router();

router.get('/catalog', listCatalog);

router.post('/catalog', createCatalog);
router.patch('/catalog/reorder', reorderCatalog);
router.patch('/catalog/:key', updateCatalog);

router.get('/users/:userId/state-indicators', getUserSelections);
router.patch('/users/:userId/state-indicators', setUserSelections);

module.exports = router;
