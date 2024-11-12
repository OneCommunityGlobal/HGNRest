const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController')();

router.get('/search-faqs', faqController.searchFAQs);
router.post('/add-faq', faqController.createFAQ);
router.put('/edit-faq/:id', faqController.updateFAQ);
router.post('/log-unanswered', faqController.logUnansweredQuestion);

module.exports = router;
