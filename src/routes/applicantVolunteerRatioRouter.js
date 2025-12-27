const express = require('express');
const controller = require('../controllers/applicantVolunteerRatioController')();

const router = express.Router();

router.get('/analytics', controller.getAllApplicantVolunteerRatios);
router.get('/:id', controller.getApplicantVolunteerRatioById);
router.post('/', controller.createApplicantVolunteerRatio);
router.put('/:id', controller.updateApplicantVolunteerRatio);
router.delete('/:id', controller.deleteApplicantVolunteerRatio);

module.exports = router;
