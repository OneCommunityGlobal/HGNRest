// emailController.js
const nodemailer = require('nodemailer');

const sendEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    console.log(html)

    // Creating a transporter using email service's credentials
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email data
    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html,
    };

    // Sending the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send('Error sending email');
  }
};

module.exports = {sendEmail};

