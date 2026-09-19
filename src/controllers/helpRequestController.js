const mongoose = require('mongoose');
const HelpRequest = require('../models/helpRequest');
const HelpFeedback = require('../models/helpFeedback');

const createHelpRequest = async (req, res) => {
  try {
    const { userId, topic, description } = req.body;

    const helpRequest = new HelpRequest({
      userId,
      topic,
      description,
    });

    await helpRequest.save();
    res.status(201).json(helpRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkIfModalShouldShow = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('=== CHECK MODAL DEBUG ===');
    console.log('userId from params:', userId);

    // FIX ISSUE #5: Check if user has closed permanently
    const permanentlyClosed = await HelpFeedback.findOne({
      userId, // USE STRING DIRECTLY, NOT OBJECTID
      closedPermanently: true,
    });

    console.log('permanentlyClosed:', permanentlyClosed);

    if (permanentlyClosed) {
      return res.status(200).json({ shouldShow: false });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    console.log('oneWeekAgo:', oneWeekAgo);

    const helpRequest = await HelpRequest.findOne({
      userId, // USE STRING DIRECTLY, NOT OBJECTID
      requestedAt: { $lte: oneWeekAgo },
      feedbackSubmitted: false,
    }).sort({ requestedAt: -1 });

    console.log('helpRequest found:', helpRequest);

    if (helpRequest) {
      return res.status(200).json({
        shouldShow: true,
        helpRequestId: helpRequest._id,
        requestedAt: helpRequest.requestedAt,
      });
    }

    res.status(200).json({ shouldShow: false });
  } catch (error) {
    console.error('Error in checkIfModalShouldShow:', error);
    res.status(500).json({ error: error.message });
  }
};
const updateRequestDate = async (req, res) => {
  try {
    const { helpRequestId, requestedAt } = req.body;

    const updated = await HelpRequest.findByIdAndUpdate(
      helpRequestId,
      { requestedAt: new Date(requestedAt) },
      { new: true },
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const getAllHelpRequests = async (req, res) => {
  try {
    const requests = await HelpRequest.find({});
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createHelpRequest,
  checkIfModalShouldShow,
  updateRequestDate,
  getAllHelpRequests,
};
