const HelpFeedback = require('../models/helpFeedback');
const HelpRequest = require('../models/helpRequest');

const submitFeedback = async (req, res) => {
  try {
    const { userId, helpRequestId, receivedHelp, activeMembers, inactiveMembers, comments } =
      req.body;

    if (!userId || !receivedHelp) {
      return res.status(400).json({
        error: 'userId and receivedHelp are required',
      });
    }

    const feedback = new HelpFeedback({
      userId,
      helpRequestId,
      receivedHelp,
      activeMembers,
      inactiveMembers,
      comments,
    });

    await feedback.save();

    if (helpRequestId) {
      await HelpRequest.findByIdAndUpdate(helpRequestId, {
        feedbackSubmitted: true,
      });
    }

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback,
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

const closePermanently = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const feedback = new HelpFeedback({
      userId,
      receivedHelp: 'no',
      closedPermanently: true,
      submittedAt: new Date(),
    });

    await feedback.save();

    res.status(200).json({
      message: 'Modal closed permanently for this user',
    });
  } catch (error) {
    console.error('Error closing permanently:', error);
    res.status(500).json({ error: 'Failed to close permanently' });
  }
};

module.exports = {
  submitFeedback,
  closePermanently,
};
