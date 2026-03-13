const express = require('express');
const {
  getForms,
  getForm,
  createForm,
  deleteForm,
  updateForm,
} = require('../controllers/resourceManagementController');

const router = express.Router();

// GET all forms
router.get('/', getForms);

// GET a single form
router.get('/:id', getForm);

// POST a new form
router.post('/', createForm);

// DELETE a form
router.delete('/:id', deleteForm);

// UPDATE a form
router.patch('/:id', updateForm);

module.exports = router;
