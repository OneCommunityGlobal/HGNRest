const express = require('express');
const helpCategoryController = require('../controllers/helpCategoryController');

const router = express.Router();

router.get('/', helpCategoryController.getAllHelpCategories);
router.post('/', helpCategoryController.createHelpCategory);
router.put('/:id', helpCategoryController.updateHelpCategory);

module.exports = router;