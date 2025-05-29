const mongoose = require('mongoose');
const {
  twilioSendSMS: TwilioSMSSender,
  TextbeltSMS: TextbeltSMSSender,
  TelesignSMS: TelesignSMSSender,
} = require('../../utilities/SMSSender');

const { addBidToHistory } = require('../../controllers/lbdashboard/bidDeadlinesController')();

const emailSender = require('../../utilities/emailSender');

const BidDeadlines = require('../../models/lbdashboard/bidDeadline');

let io = null; // socket will be stored here

async function emailNotifications(toEmailAddress, amount) {
  const emailBidBody = `
  <h2>Thank you for your bid!</h2>
  <p>We have received your bid $${amount} successfully.</p>
  <p>We'll get back to you shortly.</p>
  <br>
  <p>Regards,<br>Team HGN</p>
`;
  console.log(emailBidBody);
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

  await emailSender(
    toEmailAddress, // recipents 'onecommunityglobal@gmail.com',
    'Received Bid', // subject
    emailBidBody, // message
    null, // attachments
    null, //  cc
    'onecommunityglobal@gmail.com', // reply to
  );
  console.log('email sent');
}
async function SMSNotifications(smsMsg, toMobile) {
  // textBelt
  const textBeltSMSSendRes = await TextbeltSMSSender(smsMsg, toMobile);
  console.log('textBeltSMSSendRes?.data below');

  console.log(textBeltSMSSendRes?.data);

  // telesign
  const telesignSMSSendRes = await TelesignSMSSender(smsMsg, toMobile);
  console.log(telesignSMSSendRes);
  console.log('telesignSMSSendRes above');

  // Twilio
  const fromMob = '+15005550006'; // Magic "from" number (valid for testing)
  const toMob = '+15005550006'; // Magic "to" number simulates success
  const twilioSMSSenderResp = await TwilioSMSSender(smsMsg, fromMob, toMob);
  console.log('twilioSMSSenderResp below');
  console.log(twilioSMSSenderResp);
}
function initSocket(server) {
  console.log('socketIO inside');
  const socketIO = require('socket.io');
  const Bids = require('../../models/lbdashboard/bids');
  const Users = require('../../models/lbdashboard/users');

  // Load and apply socket auth middleware
  const socketAuth = require('../../startup/socket-auth-middleware');

  io = socketIO(server, {
    cors: { origin: '*' },
    methods: ['GET', 'POST'], // allow all origins for now (adjust for production)
  });

  io.use(socketAuth);

  io.engine.on('connection_error', (err) => {
    console.log('io.engine error');
    // console.log(err.req); // the request object
    // console.log(err.code); // the error code, for example 1
    // console.log(err.message); // the error message, for example "Session ID unknown"
    // console.log(err.context); // some additional error context
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
  const onlineUsers = {};
  io.on('connection', (socket) => {
    socket.on('register', (userEmail) => {
      onlineUsers[userEmail] = socket.id;
      console.log(userEmail);
    });
    console.log('now');
    console.log(onlineUsers);
    socket.on('new-bid', async ({ listingId, amount }) => {
      // const listingId = mongoose.Types.ObjectId('67da392415114d82e8f27727'); // 67dc4d543f1a8ec3a678fd70');
      console.log(`itemId is ${listingId}`);
      console.log(`amount is ${amount}`);
      console.log(`user is ${socket.handshake.auth.email}`);

      const user = await Users.findOne({
        email: socket.handshake.auth.email,
      });
      console.log('user');
      console.log(user);

      const userId = user?._id;
      console.log(userId);

      const userMobile = user?.mobile;
      console.log(userMobile);

      try {
        const bidDeadlines = await BidDeadlines.findOne({
          listingId,
          isActive: true,
        });
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
        console.log(bidDeadlines.biddingHistory.length);
        const lastBid = bidDeadlines.biddingHistory[bidDeadlines.biddingHistory.length - 1];
        console.log(lastBid);
        console.log(!lastBid);
        console.log(amount);
        console.log(bidDeadlines);
        if (bidDeadlines)
          if (lastBid === undefined) {
            await addBidToHistory(BidDeadlines, listingId, amount);
            /* await BidDeadlines.updateOne(
              { listingId },
              {
                $push: {
                  biddingHistory: {
                    bidPrice: mongoose.Types.Decimal128.fromString(amount.toString()),
                    createdDatetime: new Date(),
                  },
                },
              },
            ); */
          } else if (parseFloat(amount) <= parseFloat(lastBid.bidPrice)) {
            io.emit('bid-not-updated', `bidPrice should be greater than ${lastBid.bidPrice}`);

            return `bidPrice should be greater than ${lastBid.bidPrice}`;
          } else {
            await addBidToHistory(BidDeadlines, listingId, amount);

            /* await BidDeadlines.updateOne(
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
*/
            console.log({
              listingId, // mongoose.Types.ObjectId(listingId),
              userId,
            });
          }
        const matchBid = await Bids.findOne({
          listingId, // mongoose.Types.ObjectId(listingId),
          userId,
        });
        console.log(matchBid);
        console.log(matchBid.id);
        console.log(mongoose.Types.Decimal128.fromString(amount.toString()));
        /* await Bids.updateOne(
          { listingId, userId },
          {
            $push: {
              biddingHistory: {
                bidPrice: mongoose.Types.Decimal128.fromString(amount.toString()),
                createdDatetime: new Date(),
              },
            },
          },
        ); */
        await addBidToHistory(Bids, listingId, amount);
      } catch (error) {
        console.log("error 244");
      }
      console.log('Bid Received');
      console.log('before callback');

      console.log(userMobile);
      const smsMsg = `Thank you for your bid!
  We have received your bid $${amount} successfully.
  We'll get back to you shortly.
  Regards,<br>Team HGN`;

      SMSNotifications(smsMsg, userMobile);
      /*       const smsMsg = `Thank you for your bid!
  We have received your bid $${amount} successfully.
  We'll get back to you shortly.
  Regards,<br>Team HGN`;
      // textBelt
      const textBeltSMSSendRes = await TextbeltSender(smsMsg, userMobile);
      console.log(textBeltSMSSendRes?.data);

      // telesign
      const telesignSMSSendRes = await TelesignSMSSender(smsMsg, userMobile);
      console.log(telesignSMSSendRes);
      console.log('telesignSMSSendRes above');
      // Twilio
      // const SMSBody = 'New Bid Received';
      const fromMob = '+15005550006'; // Magic "from" number (valid for testing)
      const toMob = '+15005550006'; // Magic "to" number simulates success

      const SMSSenderResp = await SMSSender(smsMsg, fromMob, toMob);
      console.log('SMSSenderResp');
      console.log(SMSSenderResp); */
      emailNotifications(socket.handshake.auth.email, amount);
      /*
      const emailBidBody = `
  <h2>Thank you for your bid!</h2>
  <p>We have received your bid $${amount} successfully.</p>
  <p>We'll get back to you shortly.</p>
  <br>
  <p>Regards,<br>Team HGN</p>
`;
      console.log(emailBidBody);
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

      emailSender(
        'meenu.ajai@gmail.com', // recipents 'onecommunityglobal@gmail.com',
        'Received Bid', // subject
        emailBidBody, // message
        null, // attachments
        null, //  cc
        'onecommunityglobal@gmail.com', // reply to
      );
      console.log('email sent');
*/
      // res.status(200).send("Success");

      // Notify all connected clients
      io.emit('bid-updated', `current bid price is ${amount}`);

      socket.broadcast.emit('bid-updated', `current bid price is ${amount}`);

      socket.on('disconnect', () => {
        Object.entries(onlineUsers).forEach(([userEmail, sid]) => {
          if (sid === socket.id) {
            delete onlineUsers[userEmail];
          }
        });

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
  if (!io) {
    console.error('Socket.io not initialized');
  }
  return io;
}
initSocket.sendNotifications = sendNotifications;
initSocket.getIO = getIO;
module.exports = { initSocket, sendNotifications, SMSNotifications, getIO };
