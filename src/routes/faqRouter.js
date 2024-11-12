const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController')();
const { hasFaqPermission } = require('../utilities/permissions');

const checkFaqPermission = (action) => async (req, res, next) => {
    const hasPermission = await hasFaqPermission(req.user, action);

    if (hasPermission) {
        return next();
    } else {
        return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
};

router.get('/search-faqs', faqController.searchFAQs);
router.post('/add-faq', checkFaqPermission('faq_create'), faqController.createFAQ);
router.put('/edit-faq/:id', checkFaqPermission('faq_edit'), faqController.updateFAQ);
router.post('/log-unanswered', faqController.logUnansweredQuestion);

module.exports = router;
