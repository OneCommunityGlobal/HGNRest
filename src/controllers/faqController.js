const FAQ = require('../models/faqs');
const { sendEmail } = require('./emailController');
const UnansweredFAQ = require('../models/unansweredFaqs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');
const Role = require('../models/role');

const verifyToken = async (req) => {
    console.log("Verifying token...");
    const token = req.headers['authorization'];
    if (!token) {
        console.log("No token provided in the request headers.");
        throw new Error('No token provided');
    }
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        if (!decoded || !decoded.expiryTimestamp || moment().isAfter(decoded.expiryTimestamp)) {
            throw new Error('Token is invalid or expired');
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
        return req.user;
    } catch (error) {
        console.error("Token verification error:", error.message);
        throw new Error('Invalid or expired token');
    }
};

const faqController = function () {
    const searchFAQs = async function (req, res) {
        const searchQuery = req.query.q;
        try {
            const results = await FAQ.find({
                question: { $regex: searchQuery, $options: 'i' }
            }).limit(5);
            res.status(200).send(results);
        } catch (error) {
            console.error('Error searching FAQs:', error);
            res.status(500).json({ message: 'Error searching FAQs', error });
        }
    };

    const getTopFAQs = async function (req, res) {
        try {
            const faqs = await FAQ.find().sort({ updatedAt: -1 }).limit(20);
            res.status(200).json(faqs);
        } catch (error) {
            console.error('Error fetching top FAQs:', error);
            res.status(500).json({ message: 'Error fetching FAQs', error });
        }
    };

    const createFAQ = async function (req, res) {
        console.log("Creating FAQ...");
        try {
            await verifyToken(req);
            if (!Array.isArray(req.user.permissions) || !req.user.permissions.includes('manageFAQs')) {
                return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            }

            const { question, answer } = req.body;
            const createdBy = req.user.userid;

            const newFAQ = new FAQ({
                question,
                answer,
                createdBy,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await newFAQ.save();
            console.log("FAQ created and saved:", newFAQ);
            res.status(201).json({ message: 'FAQ created successfully', newFAQ });
        } catch (error) {
            console.error('Error creating FAQ:', error);
            res.status(500).json({ message: error.message });
        }
    };

    const updateFAQ = async function (req, res) {
        try {

            await verifyToken(req);
            if (!req.user.permissions.includes('manageFAQs')) {
                return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            }

            const { id } = req.params;
            const { question, answer } = req.body;
            const modifiedBy = req.user.userid;

            const originalFAQ = await FAQ.findById(id);
            if (!originalFAQ) {
                return res.status(404).json({ message: 'FAQ not found' });
            }

            originalFAQ.changeHistory.push({
                modifiedBy,
                modifiedAt: new Date(),
                previousQuestion: originalFAQ.question,
                previousAnswer: originalFAQ.answer,
            });

            originalFAQ.question = question;
            originalFAQ.answer = answer;
            originalFAQ.modifiedBy = modifiedBy;
            originalFAQ.updatedAt = new Date();

            await originalFAQ.save();

            res.status(200).json({ message: 'FAQ updated successfully', updatedFAQ: originalFAQ });
        } catch (error) {
            console.error('Error updating FAQ:', error);
            res.status(500).json({ message: error.message });
        }
    };

    const deleteFAQ = async (req, res) => {
        try {
            const { id } = req.params;
            const faq = await FAQ.findByIdAndDelete(id);

            if (!faq) {
                return res.status(404).json({ message: 'FAQ not found' });
            }

            res.status(200).json({ message: 'FAQ deleted successfully' });
        } catch (error) {
            console.error('Error deleting FAQ:', error);
            res.status(500).json({ message: 'Error deleting FAQ' });
        }
    };

    const logUnansweredFAQ = async function (req, res) {
        try {
            await verifyToken(req);

            const { question } = req.body;
            const createdBy = req.user.userid;

            const existingQuestion = await UnansweredFAQ.findOne({ question });
            if (existingQuestion) {
                return res.status(409).json({ message: 'This question has already been logged' });
            }

            const newUnansweredFAQ = new UnansweredFAQ({
                question,
                createdBy,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await newUnansweredFAQ.save();

            const emailData = {
                to: process.env.OWNER_EMAIL,
                subject: 'New Unanswered FAQ Logged',
                html: `<p>A new unanswered question has been logged:</p><p><strong>Question:</strong> ${question}</p><p>Please review and add an answer if necessary.</p>`,
            };

            await sendEmail({ body: emailData }, res);

            res.status(201).json({ message: 'Question logged successfully', newUnansweredFAQ });
        } catch (error) {
            console.error('Error logging unanswered FAQ:', error);
            res.status(500).json({ message: error.message });
        }
    };

    return { searchFAQs, getTopFAQs, createFAQ, updateFAQ, deleteFAQ, logUnansweredFAQ };
};

module.exports = faqController;