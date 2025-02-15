const FAQ = require('../models/faqs');
const UnansweredFAQ = require('../models/unansweredFaqs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');
const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');

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


const getAllFAQs = async function (req, res) {
    try {
        const faqs = await FAQ.find().sort({ updatedAt: -1 });
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
            changeHistory: []
        });

        await newFAQ.save();
        console.log("FAQ created and saved with initial change history:", newFAQ);
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
        const updatedBy = req.user.userid;

        const originalFAQ = await FAQ.findById(id);
        if (!originalFAQ) {
            return res.status(404).json({ message: 'FAQ not found' });
        }

        originalFAQ.changeHistory.push({
            updatedBy,
            updatedAt: new Date(),
            previousQuestion: originalFAQ.question,
            previousAnswer: originalFAQ.answer,
            updatedQuestion: question,
            updatedAnswer: answer
        });

        originalFAQ.question = question;
        originalFAQ.answer = answer;
        originalFAQ.updatedBy = updatedBy;
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
        });
        await newUnansweredFAQ.save();

        const ownerEmail = process.env.OWNER_EMAIL || 'jae@onecommunityglobal.org';

        const emailMessage = `
            <p>A new unanswered question has been logged:</p>
            <p><strong>Question:</strong> ${question}</p>
            <p>Please review and add an answer if necessary.</p>
        `;

        console.log("Queuing email for owner:", ownerEmail);

        emailSender(
            ownerEmail,
            'New Unanswered FAQ Logged',
            emailMessage,
            null,
            null,
            null
        );

        console.log("Email queued for sending.");

        res.status(201).json({ message: 'Question logged successfully', newUnansweredFAQ });
    } catch (error) {
        console.error('Error logging unanswered FAQ:', error);
        res.status(500).json({ message: error.message });
    }
};

const getFAQHistory = async function (req, res) {
    try {
        const { id } = req.params;
        const faq = await FAQ.findById(id);

        if (!faq) {
            return res.status(404).json({ message: 'FAQ not found' });
        }

        let createdByName = 'Unknown';
        if (faq.createdBy) {
            const createdByUser = await UserProfile.findById(faq.createdBy).select('firstName lastName');
            if (createdByUser) {
                createdByName = `${createdByUser.firstName} ${createdByUser.lastName}`;
            }
        }

        const changeHistoryWithNames = await Promise.all(
            faq.changeHistory.map(async (change) => {
                let updatedByName = 'Unknown';
                if (change.updatedBy) {
                    const updatedByUser = await UserProfile.findById(change.updatedBy).select('firstName lastName');
                    if (updatedByUser) {
                        updatedByName = `${updatedByUser.firstName} ${updatedByUser.lastName}`;
                    }
                }

                return {
                    updatedBy: updatedByName,
                    updatedAt: change.updatedAt,
                    previousQuestion: change.previousQuestion,
                    previousAnswer: change.previousAnswer,
                    updatedQuestion: change.updatedQuestion,
                    updatedAnswer: change.updatedAnswer,
                };
            })
        );

        res.status(200).json({
            question: faq.question,
            answer: faq.answer,
            createdBy: createdByName,
            createdAt: faq.createdAt,
            changeHistory: changeHistoryWithNames
        });
    } catch (error) {
        console.error('Error fetching FAQ history:', error);
        res.status(500).json({ message: 'Error fetching FAQ history' });
    }
};

const getUnansweredFAQs = async function (req, res) {
    try {
        const unansweredFaqs = await UnansweredFAQ.find().sort({ createdAt: -1 });
        res.status(200).json(unansweredFaqs);
    } catch (error) {
        console.error('Error fetching unanswered FAQs:', error);
        res.status(500).json({ message: 'Error fetching unanswered FAQs' });
    }
};

const deleteUnansweredFAQ = async function (req, res) {
    try {
        const { id } = req.params;
        const faq = await UnansweredFAQ.findByIdAndDelete(id);

        if (!faq) {
            return res.status(404).json({ message: 'Unanswered FAQ not found' });
        }

        res.status(200).json({ message: 'Unanswered FAQ deleted successfully' });
    } catch (error) {
        console.error('Error deleting unanswered FAQ:', error);
        res.status(500).json({ message: 'Error deleting unanswered FAQ' });
    }
};

module.exports = {
    searchFAQs,
    getAllFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ,
    logUnansweredFAQ,
    getFAQHistory,
    getUnansweredFAQs,
    deleteUnansweredFAQ
};