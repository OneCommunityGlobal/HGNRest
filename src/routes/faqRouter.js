const express = require('express');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');
const router = express.Router();
const faqController = require('../controllers/faqController');
const Role = require('../models/role');
const UnansweredFAQ = require('../models/unansweredFaqs');

const verifyToken = async (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        if (!decoded || !decoded.expiryTimestamp || moment().isAfter(decoded.expiryTimestamp)) {
            return res.status(401).json({ message: 'Token is invalid or expired' });
        }

        const role = await Role.findOne({ roleName: decoded.role });
        const rolePermissions = role ? role.permissions : [];

        const personalPermissions = [
            ...(decoded.permissions?.frontPermissions || []),
            ...(decoded.permissions?.backPermissions || [])
        ];
        const combinedPermissions = Array.from(new Set([...rolePermissions, ...personalPermissions]));

        req.user = {
            userid: decoded.userid,
            role: decoded.role,
            permissions: combinedPermissions,
        };
        next();
    } catch (error) {
        console.error('JWT verification failed:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// Permission check middleware
const checkFaqPermission = (requiredPermission) => (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(requiredPermission)) {
        return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
};

// Define routes with verifyToken and checkFaqPermission
router.get('/faqs/search', verifyToken, faqController.searchFAQs);
router.get('/faqs', verifyToken, faqController.getAllFAQs);
router.post('/faqs', verifyToken, checkFaqPermission('manageFAQs'), faqController.createFAQ);
router.put('/faqs/:id', verifyToken, checkFaqPermission('manageFAQs'), faqController.updateFAQ);
router.delete('/faqs/:id', verifyToken, checkFaqPermission('manageFAQs'), faqController.deleteFAQ);
router.post('/faqs/log-unanswered', verifyToken, faqController.logUnansweredFAQ);
router.get('/faqs/:id/history', verifyToken, checkFaqPermission('manageFAQs'), faqController.getFAQHistory);
router.get('/faqs/unanswered', verifyToken, faqController.getUnansweredFAQs);
router.delete('/faqs/unanswered/:id', verifyToken, faqController.deleteUnansweredFAQ);
module.exports = router;
