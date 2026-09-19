const express = require('express');

const router = express.Router();
const atomController = require('../controllers/atomController');

// Initialize controller
const controller = atomController();

// Routes
router.get('/', controller.getAtoms);
router.get('/subject/:subjectId', controller.getAtomsBySubject);
router.get('/difficulty/:difficulty', controller.getAtomsByDifficulty);
router.get('/:id', controller.getAtomById);
router.post('/', controller.createAtom);
router.put('/:id', controller.updateAtom);
router.delete('/:id', controller.deleteAtom);

module.exports = router;
