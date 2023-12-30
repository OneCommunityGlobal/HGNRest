// emailController.js
const nodemailer = require( 'nodemailer' );
const emailSender = require( "../utilities/emailSender" );
const userProfile = require( "../models/userProfile" );

const sendEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    console.log('to', to); 

    emailSender(to, subject, html);
    res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send('Error sending email');
  }
};

const sendEmailToAll = async (req, res) => {
  try {
    const { subject, html } = req.body;
    const users = await userProfile.find(
      {
        firstName: 'Haoji',
        email: { $ne: null },
        isActive: true,
        emailSubscriptions: true,
      },
    );
    let to = '';
    users.forEach((user) => {
      to += `${user.email},`;
    });
    console.log('to', to); 

    emailSender(to, subject, html);
    res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send('Error sending email');
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
    res.status(200).send(user);
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    res.status(500).send('Error updating email subscriptions');
  }
};  

module.exports = {
  sendEmail,
  sendEmailToAll,
  updateEmailSubscriptions,
};

