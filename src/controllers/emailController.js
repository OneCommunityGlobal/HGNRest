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

module.exports = {
  sendEmail,
  sendEmailToAll
};

