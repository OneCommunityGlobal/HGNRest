const emailSender = require('../../utilities/emailSender');
const { noShowParticipantsData } = require('./noShowFollowUpEmailMockData');

const noShowFollowUpEmailController = function () {

    const getFollowUpEmailBody = ( firstName, eventName, eventDate, eventTime ) => 
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body>
          <p>Hello ${firstName}
          <p>We’re sorry we missed you at <b>${eventName} ${eventDate} ${eventTime}</b></p>
          <p>We hope you can join us next time! If you have any questions or need assistance, please feel free to reach out.</p>
          <p>We look forward to seeing you soon!</p>
          <p>Thank you,</p>
        </body>
      </html>`;
    
    const sendFollowUpEmailAll = async (req, res) => {
      
      const { eventName, eventDate, eventTime, participants : recipients } = noShowParticipantsData;
      const subject = `Sorry we missed you at ${eventName}`;
      
      try {
            const updatedRecipients = recipients.map((recipient) => { 
              const body = getFollowUpEmailBody( recipient.name, eventName, eventDate, eventTime )
              return { ...recipient, message: body };
            });
            
            await Promise.all(
                updatedRecipients.map((recipient) => {
                const { email, message : emailContent } = recipient;
                return emailSender( email, subject, emailContent );
              }),
            ).then((result) => {
              res.status(200).send(result);
            }).catch((error) => {
              console.error(error.message);
            });

      } catch (error) {
          res.status(500).json({ error: 'An error occurred while sending no show follow up email.' });
      }
    }
    
    const sendFollowUpEmail = async (req, res) => {

      try {
        const { participants:selectedPraticipants, eventId } = req.body;
      
        // Check if the eventId matches noShowParticipants eventID
        if(eventId !== noShowParticipantsData.eventID) {
          return res.status(400).json({error: 'Event Id does not match'});
        }

        const { eventName, eventDate, eventTime, participants : recipients } = noShowParticipantsData;
        const subject = `Sorry we missed you at ${eventName}`;

        const updatedRecipients = recipients
            .filter((recipient) => selectedPraticipants.includes(recipient.participantID))
            .map((recipient)=>{
              const body = getFollowUpEmailBody( recipient.name, eventName, eventDate, eventTime )
              return { ...recipient, message: body };
            });
        
        await Promise.all(
          updatedRecipients.map((recipient) => {
          const { email, message : emailContent } = recipient;
          return emailSender( email, subject, emailContent );
        }),
        ).then((result) => {
          res.status(200).json({
            message: `Email sent scuccessfully to ${result.length} participants`,
          });

        }).catch((error) => {
          console.error(error);
          res.status(500).json({ error: 'An error occurred while sending emails.' });
        });

      } catch(error) {
        console.log(error);
        res.status(500).json({ error: 'An error occurred while sending emails.' });
      }
    };

    return {
        sendFollowUpEmailAll,
        sendFollowUpEmail
    }
};

module.exports = noShowFollowUpEmailController;



