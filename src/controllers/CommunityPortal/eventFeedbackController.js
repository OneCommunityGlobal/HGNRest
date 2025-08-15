const EventFeedback = require('../../models/communityportal/eventFeedback');
const logger = require('../../startup/logger');

const eventFeedbackController = function () {
  const submitEventFeedbackResponse = async function (req, res) {
    console.log(req.body);
    logger.logInfo(`Event Feedback Frontend : ${JSON.stringify(req.body)}`);

    const { name, email, rating, comments, eventId, attendanceId } = req.body;
    const createdBy = name;
    console.log(createdBy);
    if (!name || !email || !rating || !eventId) {
      return res.status(400).json({
        error: 'All fields (name, email, rating, eventId) are required',
      });
    }
    console.log(req.body.requestor.role);

    if (req.body.requestor.role !== 'Owner' && req.body.requestor.role !== 'Administrator') {
      res.status(403).send('You are not authorized to add changes in the eventFeedbacks.');
      return;
    }
    try {
      const eventFeedbackResponse = new EventFeedback({
        name,
        email,
        rating,
        comments,
        eventId,
        attendanceId,
        createdBy,
      });
      console.log(eventFeedbackResponse);
      await eventFeedbackResponse.save();
      res.status(201).json(eventFeedbackResponse);
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: `Failed to create eventFeedbackResponse: ${err.message}` });
    }
  };
  return { submitEventFeedbackResponse };
};
module.exports = eventFeedbackController;
