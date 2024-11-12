const FAQ = require('../models/faqs');

const faqController = function () {
    const searchFAQs = async function (req, res) {
        const searchQuery = req.query.q;
        try {
            const results = await FAQ.find({
                question: { $regex: searchQuery, $options: 'i' }
            });
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
            const updatedFAQ = await FAQ.findOneAndUpdate({ _id: id }, {
                question,
                answer,
                modifiedBy,
                updatedAt: new Date().toISOString()
            }, { new: true });
            if (!updatedFAQ) {
                return res.status(404).json({ message: 'FAQ not found' });
            }

            res.status(200).json({ message: 'FAQ updated successfully', updatedFAQ });
        } catch (error) {
            res.status(500).json({ message: 'Error updating FAQ', error });
        }

    };

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
            res.status(201).json({ message: 'Question logged successfully', newUnansweredFAQ });
        } catch (error) {
            res.status(500).json({ message: 'Error logging unanswered FAQ', error });
        }
    };
    return { searchFAQs, createFAQ, updateFAQ, logUnansweredFAQ };
}

module.exports = faqController;