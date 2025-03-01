/* eslint-disable quotes */
require('dotenv').load();
const { app, logger } = require('./app');
const websockets = require('./websockets').default;
require('./startup/db')();
require('./cronjobs/userProfileJobs')();

const port = process.env.PORT || 4500;

const server = app.listen(port, () => {
  logger.logInfo(`Started server on port ${port}`);
});
(async () => {
  await websockets(server);
})();
/**
 * Insert a document when deployed to Dev, Test, or Prod
 */
// const dotenv = require('dotenv'); // Load environment variables
const BidTerms = require('./models/lbdashboard/bidTerms'); // Import Mongoose model

// dotenv.config(); // Load .env file

async function insertInitialBidTerms() {
  try {
    const existingDoc = await BidTerms.findOne({ environment: process.env.NODE_ENV });
    if (!existingDoc) {
      const newDoc = new BidTerms({
        content:
          "This amount is the amount you''ve bid to pay for this particular unit. If you win the bid, the payment automatically goes through with the payment details you have provided on this form.  We will notify you if you win the bid.",
        cancellationPolicy: 'THERE IS NO CANCELLATION POLICY',
        isActive: true,
        environment: process.env.NODE_ENV, // Save which environment it belongs to
      });

      await newDoc.save();
      console.log(`Inserted default bid terms in ${process.env.NODE_ENV}`);
    } else {
      console.log(`Bid terms already exist for ${process.env.NODE_ENV}, skipping insertion.`);
    }
  } catch (error) {
    console.error('Error inserting default bid terms:', error);
  }
}
insertInitialBidTerms();
module.exports = server;
