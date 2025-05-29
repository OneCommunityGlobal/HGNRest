const { CronJob } = require('cron');
const mongoose = require('mongoose');
const BidDeadlines = require('../models/lbdashboard/bidDeadline');
const Bids = require('../models/lbdashboard/bids');
const Users = require('../models/lbdashboard/users');
const emailSender = require('../utilities/emailSender');
const { SMSNotifications } = require('../sockets/BiddingService/connServer');

// const connServer = require('../sockets/BiddingService/connServer');
const { getIO } = require('../sockets/BiddingService/connServer');

// const io = connServer

async function processBid(bid) {
  const lastBid = bid.biddingHistory[bid.biddingHistory.length - 1];
  console.log(bid._id);
  console.log(lastBid);
  if (lastBid !== undefined) {
    console.log('inside ProcessBid');
    console.log(lastBid.bidPrice.toString());
    return lastBid.bidPrice;
  }
}

const bidWinnerJobs = () => {
  const bidWinnerJob = new CronJob(
    '* * * * * ', // cronTime
    // '* * * * * *' // every second
    // '* * * * *', // every minute
    async () => {
      try {
        console.log('You will see this message every minute');
        // const listingId = mongoose.Types.ObjectId('67db45973f1a8ec3a678fd57');
        const now = new Date();
        const expiredBidDeadlines = await BidDeadlines.find({
          isActive: true,
          isClosed: false,
          endDate: { $lt: now },
        });
        console.log(expiredBidDeadlines);
        expiredBidDeadlines.forEach(async (deadline) => {
          const { listingId } = deadline;
          console.log(deadline);
          console.log(deadline.endDate.getTime());
          console.log('Now find the winner');
          console.log(deadline.listingId);
          const matchingBids = await Bids.find({
            listingId,
          });
          console.log(matchingBids);
          console.log('matchingBids.length');
          console.log(matchingBids.length);
          let maxBidPrice = 0;
          let bidWinner = '';
          // Use Promise.all if each operation is async
          await Promise.all(
            matchingBids.map(async (bid) => {
              // Determine winner
              const currPrice = await processBid(bid);
              console.log('currPrice');
              console.log(currPrice.toString());

              if (parseFloat(currPrice) > parseFloat(maxBidPrice)) {
                maxBidPrice = currPrice;
                bidWinner = bid.userId;
              }
              console.log('bidDeadlines bidprice');
              console.log(
                deadline.biddingHistory[deadline.biddingHistory.length - 1].bidPrice.toString(),
              );
              if (
                parseFloat(currPrice) ===
                parseFloat(deadline.biddingHistory[deadline.biddingHistory.length - 1].bidPrice)
              ) {
                console.log(`winner is ${bid.userId}`);
                const user = await Users.findById({
                  _id: bid.userId,
                });
                const userId = user?._id;
                console.log(userId);
                console.log(user);
              }
            }),
          );
          if (maxBidPrice !== 0) {
            console.log(maxBidPrice.toString());
            console.log(`winner is ${bidWinner}`);
            const user = await Users.findById({
              _id: bidWinner,
            });
            const userId = user?._id;
            console.log(userId);
            console.log(user);
            // send email
            const emailWinnerBody = `
          subject: Test Email,
          html: 
            <h2>You have won the bid!!!!!!!!!</h2>
            <p>Our Payment process for the amount $${maxBidPrice} will begin shortly.</p>
            <p>And We'll let you know.</p>
            <br>
            <p>Regards,<br>Team HGN</p>`;
            console.log(user.email);

            emailSender(
              user.email, // recipents 'onecommunityglobal@gmail.com',
              'Received Bid', // subject
              emailWinnerBody, // message
              null, // attachments
              null, //  cc
              user.email, // reply to
            );
            console.log('email sent');

            // send sms
            const SMSBody = 'Congratulations!!!! You have won the Bid';
            const fromMob = '+15005550006'; // Magic "from" number (valid for testing)
            const toMob = '+15005550006'; // Magic "to" number simulates success
            // const SMSResp = await SMSNotifications(SMSBody, fromMob, toMob);

            const SMSResp = await SMSNotifications(SMSBody, toMob);
            console.log('SMSResp from bidWinnerJobs Cron Jobs');
            console.log(SMSResp);

            // send in-app notification
            // Notify all connected clients
            console.log('Getting socket IO instance...');
            const io = getIO();
            console.log('io is', io);
            if (io) {
              io.emit('Bid-Won', 'You won the Bid!!!!!!');
            }

            /*          const io = connServer.getIO();
          if (io) {
            connServer.io.emit('Bid-Won', 'Congratulations you won the bid');
          } else {
            console.error('Socket.io not initialized yet!');
          } */
          }
          deadline.isClosed = true;
          await deadline.save();
        });
      } catch (error) {
        console.log('error');
        console.log(error);
      }
    }, // onTick
    null, // onComplete
    false, // true, // start
    // 'America/Los_Angeles', // timeZone
  );
  bidWinnerJob.start(); // is optional here because of the fourth parameter set to true.
};
module.exports = bidWinnerJobs;
