const FAQ = require('../models/faqs');

const faqController = function () {
    const searchFAQs = async function (req, res) {
        const searchQuery = req.query.q;
        try {
            const results = await FAQ.find({
                question: { $regex: searchQuery, $options: 'i' }
            }).limit(5);
            res.status(200).send(results);
        } catch (error) {
            res.status(500).json({ message: 'Error searching FAQs', error });
        }
    };

    const createFAQ = async function (req, res) {
        const { question, answer } = req.body;
        const createdBy = req.user._id;

        try {
            const newFAQ = new FAQ({
                question,
                answer,
                createdBy,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await newFAQ.save();
            res.status(201).json({ message: 'FAQ created successfully', newFAQ });
        } catch (error) {
            res.status(500).json({ message: 'Error creating FAQ', error });
        }
    };

    const updateFAQ = async function (req, res) {
        const { id } = req.params;
        const { question, answer } = req.body;
        const modifiedBy = req.user._id;

        try {
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
            res.status(500).json({ message: 'Error updating FAQ', error });
        }

    };

    const { sendEmail } = require('./emailController');
    const UnansweredFAQ = require('../models/unansweredFaqs');

    const logUnansweredFAQ = async function (req, res) {
        const { question } = req.body;
        const createdBy = req.user._id;

        try {
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
            res.status(500).json({ message: 'Error logging unanswered FAQ', error });
        }
    };
    return { searchFAQs, createFAQ, updateFAQ, logUnansweredFAQ };
}

module.exports = faqController;