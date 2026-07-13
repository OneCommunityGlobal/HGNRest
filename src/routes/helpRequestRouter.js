const express = require('express');

const router = express.Router();
const {
  createHelpRequest,
  checkIfModalShouldShow,
  updateRequestDate,
  getAllHelpRequests,
} = require('../controllers/helpRequestController');

// Temporarily bypass auth for testing
router.post(
  '/create',
  (req, res, next) => {
    req.body.requestor = { requestorId: req.body.userId };
    next();
  },
  createHelpRequest,
);

router.get('/check-modal/:userId', checkIfModalShouldShow);
router.put('/update-date', updateRequestDate);
router.get('/all', getAllHelpRequests);

module.exports = router;
