const mongoose = require('mongoose');
const { google } = require('googleapis');
const twilio = require('twilio');

const client = twilio(process.env.twilio_testAccountSid, process.env.twilio_testAuthToken);

const nodemailer = require('nodemailer');
const emailSender = require('../../utilities/emailSender');

const BidDeadlines = require('../../models/lbdashboard/bidDeadline');

let io = null; // socket will be stored here

async function sendSMS(bodySMS, fromMob, toMob) {
  client.messages
    .create({
      body: bodySMS, // 'Hello SMS',
      from: fromMob, // '+15005550006', // Magic "from" number (valid for testing)
      to: toMob, // '+15005550006', // Magic "to" number simulates success
      // to: '+15005550001', // Magic "to" number simulates invalid number
      // to: '+15005550007', // Success
      // to: '+15005550008', // Success
      // to: '+15005550009', //  Unknown error
    })
    .then((message) => {
      console.log('then');
      console.log(message.sid);
      console.log(message.body);
      return message;
    })
    .catch((error) => {
      console.log(error);
      return 'Error sending SMS';
    });
}
// const { VONAGE_API_KEY } = process.env;
// const { VONAGE_API_SECRET } = process.env;
// const { SMS_SENDER_ID } = process.env;

// const { Vonage } = require('@vonage/server-sdk');

/* const vonage = new Vonage({
  apiKey: VONAGE_API_KEY,
  apiSecret: VONAGE_API_SECRET,
});

function vonSendSMS() {
  vonage.sms
    .send({
      to: process.env.phone,
      from: SMS_SENDER_ID,
      text: 'A text message sent using the Vonage SMS API',
    })
    .then((resp) => {
      console.log('Message sent successfully');
      console.log(resp);
    })
    .catch((err) => {
      console.log('There was an error sending the messages.');
      console.error(err);
    });
}
    */
function TextbeltSMS() {
  const axios = require('axios');

  axios
    .post('https://textbelt.com/text', {
      phone: process.env.phone,
      message: 'Hello from Textbelt SMS!',
      key: 'textbelt_test', // Free public API key (1 message/day)
    })
    .then((response) => {
      console.log('Textbelt Reponse Below');
      console.log(response.data);
      console.log('Textbelt Reponse Above');
    })
    .catch((error) => {
      console.error(error);
    });
}
function sendBidSMS(toPhone, bidAmount) {
  client.messages
    .create({
      body: `A new bid of ₹${bidAmount} has been placed.`,
      from: process.env.phone, // your Twilio number
      to: toPhone, // recipient's phone number
    })
    .then((message) => console.log('SMS sent:', message.sid))
    .catch((err) => console.error('SMS error:', err));
}

// module.exports = function (server) {  working fine
// module.exports =
function soc(server) {
  console.log('socketIO inside');
  const socketIO = require('socket.io');
  const Bids = require('../../models/lbdashboard/bids');
  const Users = require('../../models/lbdashboard/users');

  function createRawEmail(to, subject, message) {
    const emailLines = [
      `To: ${to}`,
      'Subject: ' + subject,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      message,
    ];

    const email = emailLines.join('\n');

    const encodedMessage = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodedMessage;
  }

  // const
  io = socketIO(server, {
    cors: { origin: '*' },
    methods: ['GET', 'POST'], // allow all origins for now (adjust for production)
  });
  io.engine.on('connection_error', (err) => {
    console.log('io.engine error');
    console.log(err.req); // the request object
    console.log(err.code); // the error code, for example 1
    console.log(err.message); // the error message, for example "Session ID unknown"
    console.log(err.context); // some additional error context
  });

  // Simple token validation function
  function isValid(token) {
    // Replace with real validation, e.g. JWT verification
    return token === process.env.socket_token;
  }
  io.use((socket, next) => {
    console.log('before token');
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (isValid(token)) {
      next();
    } else {
      next(new Error('invalid'));
    }
  });

  io.emit('hi', 'everyone');

  io.on('connection', (socket) => {
    socket.on('new-bid', async ({ listId, amount, bidder }) => {
      const listingId = mongoose.Types.ObjectId('67dc4d543f1a8ec3a678fd70');
      console.log(`itemId is ${listingId}`);
      console.log(`amount is ${amount}`);
      console.log(`user is ${socket.handshake.auth.email}`);

      try {
        const bidDeadlines = await BidDeadlines.findOne({
          listingId,
          isActive: true,
        });
        // const bidDeadlineId = bidDeadlines?._id;
        console.log(bidDeadlines);
        const currDate = Date.now();
        console.log('currDate');
        console.log(currDate);
        console.log(bidDeadlines.endDate.getTime());
        if (bidDeadlines && currDate > bidDeadlines.endDate.getTime()) {
          io.emit('bid-not-updated', 'Time Elapsed! Bidding is over');
          return 'Time Elapsed! Bidding is over';
        }
        console.log('amount checking');
        console.log(
          bidDeadlines.biddingHistory[bidDeadlines.biddingHistory.length - 1].bidPrice.toString(),
        );
        console.log(amount);

        console.log(
          parseFloat(amount) <=
            parseFloat(
              bidDeadlines.biddingHistory[bidDeadlines.biddingHistory.length - 1].bidPrice,
            ),
        );
        if (
          bidDeadlines &&
          parseFloat(amount) <=
            parseFloat(bidDeadlines.biddingHistory[bidDeadlines.biddingHistory.length - 1].bidPrice)
        ) {
          io.emit(
            'bid-not-updated',
            `bidPrice should be greater than ${bidDeadlines.biddingHistory[bidDeadlines.biddingHistory.length - 1].bidPrice}`,
          );

          return `bidPrice should be greater than ${bidDeadlines.biddingHistory[bidDeadlines.biddingHistory.length - 1].bidPrice}`;
        }
        await BidDeadlines.updateOne(
          { listingId },
          {
            $push: {
              biddingHistory: {
                bidPrice: mongoose.Types.Decimal128.fromString(amount.toString()),
                createdDatetime: new Date(),
              },
            },
          },
        );

        const user = await Users.findOne({
          email: socket.handshake.auth.email,
        });
        const userId = user?._id;
        console.log(userId);
        console.log(user);

        console.log({
          listingId, // mongoose.Types.ObjectId(listingId),
          userId,
        });
        const matchBid = await Bids.findOne({
          listingId, // mongoose.Types.ObjectId(listingId),
          userId,
        });
        console.log(matchBid);
        console.log(matchBid.id);
        console.log(mongoose.Types.Decimal128.fromString(amount.toString()));
        await Bids.updateOne(
          { listingId, userId },
          {
            $push: {
              biddingHistory: {
                bidPrice: mongoose.Types.Decimal128.fromString(amount.toString()),
                createdDatetime: new Date(),
              },
            },
          },
        );
      } catch (error) {
        console.log(error);
      }
      console.log('Bid Received');
      console.log('before callback');
      /* const axios = require('axios');
      const express = require('express');
      const app = express();
      const PORT = 3000;

      //  Route to start login with Google
       app.get('/login', (req, res) => {
        const redirectUri = process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI;
        const clientId = process.env.REACT_APP_EMAIL_CLIENT_ID;

        const scope = [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/gmail.send',
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

        res.redirect(authUrl);
      }); 
       app.get('/oauth-callback', async (req, res) => {
        const { code } = req.query;

        if (!code) {
          return res.send('No auth code');
        }

        try {
          const response = await axios.post(
            'https://oauth2.googleapis.com/token',
            {
              code,
              //        client_id: process.env.GOOGLE_CLIENT_ID,
              //        client_secret: process.env.GOOGLE_CLIENT_SECRET,
              //        redirect_uri: 'http://localhost:3000/oauth-callback',
              //       grant_type: 'authorization_code',

              client_id: `${process.env.REACT_APP_EMAIL_CLIENT_ID}`, 
              client_secret: `${process.env.REACT_APP_EMAIL_CLIENT_SECRET}`,
              redirect_uri: `${process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI}`, //'http://localhost:3000/oauth-callback', // must match exactly
              grant_type: 'authorization_code',
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );

          console.log('Access token:', response.data);
          res.send('Logged in!');
          const emailResponse = await axios.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            {
              raw: createRawEmail(process.env.REACT_APP_EMAIL, 'Test Subject', 'This is the body'),
            },
            {
              headers: {
                Authorization: `Bearer ${response.data.access_token}`,
                'Content-Type': 'application/json',
              },
            },
          ); 
          }
         catch (err) {
          console.error('Token exchange failed:', err.response?.data || err.message);
          res.send('Token exchange error.');
        }
      });

      //  Start the server
      app.listen(PORT, () => {
        console.log(` Server running at http://localhost:${PORT}`);
      });
*/
      const textBeltSMS = TextbeltSMS();
      console.log(textBeltSMS);
      const SMSBody = 'New Bid Received';
      const fromMob = '+15005550006'; // Magic "from" number (valid for testing)
      const toMob = '+15005550006'; // Magic "to" number simulates success

      const SMSResp = await sendSMS(SMSBody, fromMob, toMob);
      console.log('SMSResp');
      console.log(SMSResp);

      const emailBidBody = `
  <h2>Thank you for your bid!</h2>
  <p>We have received your bid $${amount} successfully.</p>
  <p>We'll get back to you shortly.</p>
  <br>
  <p>Regards,<br>Team HGN</p>
`;
      console.log(emailBidBody);
      const OAuth2Client = new google.auth.OAuth2(
        process.env.REACT_APP_EMAIL_CLIENT_ID,
        process.env.REACT_APP_EMAIL_CLIENT_SECRET,
        process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI,
      );
      OAuth2Client.setCredentials({ refresh_token: process.env.REACT_APP_EMAIL_REFRESH_TOKEN });
      // OAuth2Client.setCredentials({ access_token: config.refreshToken });

      console.log(OAuth2Client);

      try {
        const accessToken = await OAuth2Client.getAccessToken();
        console.log(accessToken);
        console.log('accessToken.token');
        console.log(accessToken.token);
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: process.env.REACT_APP_EMAIL,
            clientId: process.env.REACT_APP_EMAIL_CLIENT_ID,
            clientSecret: process.env.REACT_APP_EMAIL_CLIENT_SECRET,
            refreshToken: process.env.REACT_APP_EMAIL_REFRESH_TOKEN,
            accessToken: accessToken.token, //  Important: .token
          },
          logger: true,
          debug: true,
        });
        /* const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.REACT_APP_EMAIL,
            pass: process.env.REACT_APP_PASS,
          },
        }); 
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465, // use 587 if you're not using SSL
          secure: true, // true for 465, false for 587
          auth: {
            user: process.env.REACT_APP_EMAIL,
            pass: process.env.REACT_APP_PASS,
          },
        }); 
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465, // use 587 if you're not using SSL
          secure: true, // true for 465, false for 587
          auth: {
            type: 'OAuth2',
            user: process.env.REACT_APP_EMAIL,
            clientId: process.env.REACT_APP_EMAIL_CLIENT_ID,
            clientSecret: process.env.REACT_APP_EMAIL_CLIENT_SECRET,
            refreshToken: process.env.REACT_APP_EMAIL_REFRESH_TOKEN,
            accessToken: accessToken.token, //  Important: .token
            expires: 1484314697598,
            // pass: accessToken.token,
          },
        });
*/
        // console.log(socket.handshake.auth.email);
        /* working fine
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.REACT_APP_EMAIL,
            pass: process.env.REACT_APP_PASS,
          },
          logger: true,
          debug: true,
        });
*/
        const mailOptions = {
          from: process.env.REACT_APP_EMAIL,
          subject: 'Test Email',
          html: `
            <h2>Thank you for your bid!</h2>
            <p>We have received your bid $${amount} successfully.</p>
            <p>We'll get back to you shortly.</p>
            <br>
            <p>Regards,<br>Team HGN</p>`,
          // attachments: null,
          // cc: null,
          to: process.env.REACT_APP_EMAIL, // socket.handshake.auth.email,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent:', result);

        /* transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log('Error:', error);
          }
          console.log('Email sent:', info.response);
        });
*/
        emailSender(
          process.env.REACT_APP_EMAIL, // recipents 'onecommunityglobal@gmail.com',
          'Received Bid', // subject
          emailBidBody, // message
          null, // attachments
          null, //  cc
          process.env.REACT_APP_EMAIL, // reply to
        );
        console.log('email sent');
        // res.status(200).send("Success");
      } catch (error) {
        console.log(error);
        console.log('failed to send email');
        // res.status(500).send("Failed");
      }
      // Notify all connected clients
      io.emit('bid-updated', `current bid price is ${amount}`);

      socket.broadcast.emit('bid-updated', `current bid price is ${amount}`);

      // Send Email
      /*
      const emailBidBody = async (...args) => {
        const text = `New Bid From <b>${'user?.firstName'} ${'user?.lastName'}
        </b>:
        <br>
        <br> 
        <b> &#9913; Bid Received:</b>
        <b> &#9913; Bid Amount:</b>
        <p>${amount}</p>
        <b>Thank you,<br />
        One Community</b>`;

        return text;
      };

       const data = {
        code: 'YOUR_AUTH_CODE_FROM_GOOGLE',
        client_id: `${process.env.REACT_APP_EMAIL_CLIENT_ID}`,
        client_secret: `${process.env.REACT_APP_EMAIL_CLIENT_SECRET}`, 
        redirect_uri: `${process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI}`, //'http://localhost:3000/oauth-callback', // must match exactly
        grant_type: 'authorization_code',
      };

      axios
        .post('https://oauth2.googleapis.com/token', data, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .then((res) => {
          console.log(' Access Token:', res.data);
        })
        .catch((err) => {
          console.error(' Error:', err.response.data); // <-- this will show you what went wrong
        });
*/

      socket.on('disconnect', () => {
        console.log(' User disconnected:', socket.id);
      });
    });
  });
}
function sendNotifications(bodyS, toEmail) {
  if (io) {
    io.to(toEmail).emit('someEvent', bodyS); // example of using the socket
  } else {
    console.error('Socket.io not initialized yet!');
  }
}
function getIO() {
  return io;
}
soc.sendNotifications = sendNotifications;
soc.getIO = getIO;
module.exports = { soc, sendSMS, sendNotifications, getIO };
