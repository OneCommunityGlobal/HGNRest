const emailSender = require('../../utilities/emailSender');

const noShowFollowUpEmailController = function () {
  const getFollowUpEmailBody = (firstName, eventName, eventDate, eventTime) =>
    `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <p>Hello ${firstName}</p>
        <p>We're sorry we missed you at <b>${eventName} ${eventDate} ${eventTime}</b></p>
        <p>We hope you can join us next time! If you have any questions or need assistance, please feel free to reach out.</p>
        <p>We look forward to seeing you soon!</p>
        <p>Thank you,</p>
      </body>
    </html>`;

  const sendFollowUpEmailAll = async (req, res) => {
    try {
      const { eventName, eventDate, eventTime, participants: recipients } = req.body;

      if (!eventName || !eventDate || !eventTime || !recipients || recipients.length === 0) {
        return res.status(400).json({ error: 'Missing required event or participant data.' });
      }

      const subject = `Sorry we missed you at ${eventName}`;

      const updatedRecipients = recipients.map((recipient) => {
        const body = getFollowUpEmailBody(recipient.name, eventName, eventDate, eventTime);
        return { ...recipient, message: body };
      });

      await Promise.all(
        updatedRecipients.map((recipient) => {
          const { email, message: emailContent } = recipient;
          return emailSender(email, subject, emailContent);
        }),
      )
        .then((result) => {
          res.status(200).send(result);
        })
        .catch((error) => {
          console.error(error.message);
          res.status(500).json({ error: 'An error occurred while sending emails.' });
        });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while sending no show follow up email.' });
    }
  };

  const sendFollowUpEmail = async (req, res) => {
    try {
      const {
        participants: selectedParticipants,
        eventId,
        eventName,
        eventDate,
        eventTime,
        allParticipants,
      } = req.body;

      if (!eventId || !selectedParticipants || selectedParticipants.length === 0) {
        return res.status(400).json({ error: 'Missing required event or participant data.' });
      }

      if (!eventName || !eventDate || !eventTime || !allParticipants) {
        return res.status(400).json({ error: 'Missing event details or participant list.' });
      }

      const subject = `Sorry we missed you at ${eventName}`;

      const updatedRecipients = allParticipants
        .filter((recipient) => selectedParticipants.includes(recipient.participantID))
        .map((recipient) => {
          const body = getFollowUpEmailBody(recipient.name, eventName, eventDate, eventTime);
          return { ...recipient, message: body };
        });

      if (updatedRecipients.length === 0) {
        return res.status(400).json({ error: 'No matching participants found.' });
      }

      await Promise.all(
        updatedRecipients.map((recipient) => {
          const { email, message: emailContent } = recipient;
          return emailSender(email, subject, emailContent);
        }),
      )
        .then((result) => {
          res.status(200).json({
            message: `Email sent successfully to ${result.length} participants`,
          });
        })
        .catch((error) => {
          console.error(error);
          res.status(500).json({ error: 'An error occurred while sending emails.' });
        });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'An error occurred while sending emails.' });
    }
  };

  return {
    sendFollowUpEmailAll,
    sendFollowUpEmail,
  };
};

module.exports = noShowFollowUpEmailController;
