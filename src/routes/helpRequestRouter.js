const express = require('express');
const authenticateHelpRequest = require('../middleware/authenticateHelpRequest');
const {
  createHelpRequest,
  checkIfModalShouldShow,
  updateRequestDate,
  getAllHelpRequests,
  checkHelpRequestEligibility,
} = require('../controllers/helpRequestController');

const router = express.Router();

router.post('/create', authenticateHelpRequest, createHelpRequest);

router.get('/check-modal/:userId', checkIfModalShouldShow);
router.put('/update-date', updateRequestDate);
router.get('/all', getAllHelpRequests);
router.get('/eligibility', authenticateHelpRequest, checkHelpRequestEligibility);

module.exports = router;
