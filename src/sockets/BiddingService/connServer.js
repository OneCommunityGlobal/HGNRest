const mongoose = require('mongoose');
const {
  twilioSendSMS: TwilioSMSSender,
  TextbeltSMS: TextbeltSMSSender,
  TelesignSMS: TelesignSMSSender,
} = require('../../utilities/SMSSender');

const { addBidToHistory } = require('../../controllers/lbdashboard/bidDeadlinesController')();

console.log("inside connserver.js ") 

console.log("typeof addBidToHistory"); 
console.log(typeof addBidToHistory);


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


  const bidsController  = require('../../controllers/lbdashboard/bidsController');

  const bidsControllerInstance = bidsController(Bids);

  const { init, updateOrderLocal } = bidsControllerInstance;

  init();

   console.log("typeof bidsController"); 
 console.log(typeof bidsController);

 console.log('typeof bC:', typeof updateOrderLocal);
 console.log('bC.default:', typeof bidsController.default);

 console.log("typeof bidsControllerInstance"); 
 console.log(typeof bidsControllerInstance);
 
 console.log("inside connserver.js ") 

 // Load and apply socket auth middleware
  const socketAuth = require('../../startup/socket-auth-middleware');

  io = socketIO(server, {
    cors: { origin: '*' },
    methods: ['GET', 'POST'], // allow all origins for now (adjust for production)
  });

  io.use(socketAuth);

  io.engine.on('connection_error', (err) => {
    console.log('io.engine error');
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
  const onlineUsers = {};
  io.on('connection', (socket) => {
    socket.on('register', (userEmail) => {
      onlineUsers[userEmail] = socket.id;
      console.log(userEmail);
    });
    console.log('now');
    console.log(onlineUsers);
    socket.on('new-bid', async ({ listingId, startDate, endDate,bidPrice }) => {
      console.log(`itemId is ${listingId}`);
      console.log(`amount is ${bidPrice}`);
      console.log(`startDate is ${startDate}`);
      console.log(`endDate is ${endDate}`);
      
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
        console.log(bidPrice);
        console.log(bidDeadlines);
        if (bidDeadlines)
          if (lastBid === undefined) {
            await addBidToHistory(BidDeadlines, listingId, bidPrice);
          } else if (parseFloat(bidPrice) <= parseFloat(lastBid.bidPrice)) {
            io.emit('bid-not-updated', `bidPrice should be greater than ${lastBid.bidPrice}`);

            return `bidPrice should be greater than ${lastBid.bidPrice}`;
          } else {
            await addBidToHistory(BidDeadlines, listingId, bidPrice);

      
            console.log({
              listingId, // mongoose.Types.ObjectId(listingId),
              userId,
            });
          }
        const matchBid = await Bids.findOne({
          listingId, // mongoose.Types.ObjectId(listingId),
          startDate,endDate,
          userId,
        });
        console.log("matched Bid details");        
        console.log(matchBid);
        console.log(matchBid.id);
    
        await updateOrderLocal({listingId:matchBid.listingId,startDate: matchBid.startDate, 
          endDate:matchBid.endDate,bidPrice, paypalOrderId:matchBid.paypalOrderId, email:socket.handshake.auth.email});
        
        // await controller.updateOrderLocal(matchBid.listingId, matchBid.startDate, matchBid.endDate,user.email, amount);
        console.log(mongoose.Types.Decimal128.fromString(bidPrice.toString()));
        await addBidToHistory(Bids, listingId, bidPrice);
        console.log('Bid Received');
      console.log('before callback');

      console.log(userMobile);
      const smsMsg = `Thank you for your bid!
  We have received your bid $${bidPrice} successfully.
  We'll get back to you shortly.
  Regards,<br>Team HGN`;

      SMSNotifications(smsMsg, userMobile);
      emailNotifications(socket.handshake.auth.email, bidPrice);
      
      } catch (error) {
        console.log("error");
        console.log(error);
        
      }
      
      // Notify all connected clients
      io.emit('bid-updated', `current bid price is ${bidPrice}`);

      socket.broadcast.emit('bid-updated', `current bid price is ${bidPrice}`);

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
    io.to(toEmail).emit('someEvent', bodyS); 
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
