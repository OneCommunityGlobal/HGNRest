// emailController.js
// eslint-disable-next-line no-unused-vars
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');

const frontEndUrl = process.env.FRONT_END_URL || 'http://localhost:3000';
const jwtSecret = process.env.JWT_SECRET || 'EmailSecret';

const sendEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    console.log('to', to);

    emailSender(to, subject, html);
    return res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).send('Error sending email');
  }
};

const sendEmailToAll = async (req, res) => {
  try {
    const { subject, html } = req.body;
    const users = await userProfile.find({
      firstName: 'Haoji',
      email: { $ne: null },
      isActive: true,
      emailSubscriptions: true,
    });
    let to = '';
    const emailContent = ` <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>


      <body>
        ${html}
      </body>
    </html>`;
    users.forEach((user) => {
      to += `${user.email},`;
    });
    emailSender(to, subject, emailContent);
    const emailList = await EmailSubcriptionList.find({ email: { $ne: null } });
    emailList.forEach((emailObject) => {
      const { email } = emailObject;
    // eslint-disable-next-line no-shadow
    const emailContent = ` <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>


        <body>
          ${html}
          <p> Thank you for subscribing to our email updates!</p>
          <p> If you would like to unsubscribe, please click <a href="${frontEndUrl}/email-unsubscribe?email=${email}">here</a></p>
        </body>
      </html>`;
      emailSender(email, subject, emailContent);
    });
    return res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).send('Error sending email');
  }
};

const updateEmailSubscriptions = async (req, res) => {
  try {
    const { emailSubscriptions } = req.body;
    const { email } = req.body.requestor;
    const user = await userProfile.findOneAndUpdate(
      { email },
      { emailSubscriptions },
      { new: true },
    );
    return res.status(200).send(user);
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    return res.status(500).send('Error updating email subscriptions');
  }
};

const addNonHgnEmailSubscription = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send('Email is required');
    }
    const emailList = await EmailSubcriptionList.find({
      email: { $eq: email },
    });
    if (emailList.length > 0) {
      return res.status(400).send('Email already exists');
    }
    const payload = { email };

    const token = jwt.sign(
      payload,
      jwtSecret,
      {
        expiresIn: 360,
      },
    );
    const emailContent = ` <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <p>Thank you for subscribing to our email updates!</p>
        <p><a href="${frontEndUrl}/email-subscribe?token=${token}">Click here to confirm your email</a></p>
      </body>
      `;
    // console.log('email', email);
    emailSender(email, 'HGN Email Subscription', emailContent);
    return res.status(200).send('Email subsribed successfully');
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    res.status(500).send('Error updating email subscriptions');
  }
};

const confirmNonHgnEmailSubscription = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).send('Invalid token');
    }
    let payload = {};
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (err) {
      // console.log(err);
      return res.status(401).json({ errors: [{ msg: 'Token is not valid' }] });
    }
    const { email } = payload;
    if (!email) {
      return res.status(400).send('Invalid token');
    }
    try {
      const newEmailList = new EmailSubcriptionList({ email });
      await newEmailList.save();
    } catch (error) {
      if (error.code === 11000) {
        return res.status(200).send('Email already exists');
      }
    }
    // console.log('email', email);
    return res.status(200).send('Email subsribed successfully');
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    return res.status(500).send('Error updating email subscriptions');
  }
};

const removeNonHgnEmailSubscription = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send('Email is required');
    }
    await EmailSubcriptionList.findOneAndDelete({
      email: { $eq: email },
    });
    // console.log('delete', email);
    return res.status(200).send('Email unsubsribed successfully');
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    return res.status(500).send('Error updating email subscriptions');
  }
};

// const sendDeactivationEmail = async (firstName, lastName, date) => {
//   try {
//     const subject = 'Notification of Team Member Deactivation';
//     const message = `
//       <p>Management,</p>
//       <p>Please note that ${firstName} ${lastName} has been made inactive in the Highest Good Network as of ${date}. Please confirm all your work with this individual has been wrapped up and nothing further is needed on their part.</p>
//       <p>With Gratitude,</p>
//       <p>One Community</p>
//     `;

//     // const recipients = [
//     //   'one.community@me.com',
//     //   'jsabol@me.com'
//     // ];


//     const recipients = [
      
//       'rajeith.t@gmail.com'
//     ];
//     // Assuming emailSender expects a single recipient or a string of recipients separated by commas
//     const to = recipients.join(',');

//     emailSender(to, subject, message, null, null, null, (error, result) => {
//       if (error) {
//         console.error('Error sending deactivation email:', error);
//       } else {
//         console.log('Deactivation email sent successfully:', result);
//       }
//     });
//   } catch (error) {
//     console.error('Error sending deactivation email:', error);
//   }
// };

// const sendDeactivationEmail = async (req, res) => {
//   console.log('inSenDeact')
//   try {
//     const { firstName, lastName, date } = req.body;
//     const subject = 'Notification of Team Member Deactivation';
//     const message = `
//       <p>Management,</p>
//       <p>Please note that ${firstName} ${lastName} has been made inactive in the Highest Good Network as of ${date}. Please confirm all your work with this individual has been wrapped up and nothing further is needed on their part.</p>
//       <p>With Gratitude,</p>
//       <p>One Community</p>
//     `;

//     const recipients = ['mailto:rajeith.t@gmail.com'];
//     const to = recipients.join(',');

//     // Using a Promise to handle the callback
//     await new Promise((resolve, reject) => {
//       emailSender(to, subject, message, null, null, null, (error, result) => {
//         if (error) {
//           console.error('Error sending deactivation email:', error);
//           reject(error);
//         } else {
//           console.log('Deactivation email sent successfully:', result);
//           resolve(result);
//         }
//       });
//     });

//     return res.status(200).send('Deactivation email sent successfully');
//   } catch (error) {
//     console.error('Error sending deactivation email:', error);
//     return res.status(500).send('Error sending deactivation email');
//   }
// };

const sendDeactivationEmail = async (firstName, lastName, date) => {
  console.log(firstName, lastName, date);
  console.log('sendDeactivationEmail function called');
 
  try {
    const subject = 'Notification of Team Member Deactivation';
    const message = `
      <p>Management,</p>
      <p>Please note that ${firstName} ${lastName} has been made inactive in the Highest Good Network as of ${date}. Please confirm all your work with this individual has been wrapped up and nothing further is needed on their part.</p>
      <p>With Gratitude,</p>
      <p>One Community</p>
    `;

    const recipients = ['rajeith.t@gmail.com']; // Add more emails as needed

    console.log(`Sending deactivation email to: ${recipients.join(', ')}`);
    
    emailSender(
      recipients.join(', '), // Joining recipients into a single string
      subject,
      message,
      null, // cc
      null, // bcc
      null, // replyTo
      (error, result) => {
        if (error) {
          console.error('Error sending deactivation email:', error);
        } else {
          console.log('Deactivation email sent successfully:', result);
        }
      }
    );
    // return res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending deactivation email:', error);
  }
};

module.exports = {
  sendEmail,
  sendEmailToAll,
  updateEmailSubscriptions,
  addNonHgnEmailSubscription,
  removeNonHgnEmailSubscription,
  confirmNonHgnEmailSubscription,
  sendDeactivationEmail,
};
