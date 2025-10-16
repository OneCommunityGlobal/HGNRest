require('dotenv').config();
const mongoose = require('mongoose');
const userhelper = require('./helpers/userHelper')();

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false, // also fixes the deprecation warning
    });
    console.log('✅ Connected!');

    console.log('🔹 Running BlueSquare test (no emails will be sent)...');
    await userhelper.assignBlueSquareForTimeNotMet();

    // Wait briefly to allow any background async tasks to complete
    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });

    console.log('✅ Finished — check console for ordering.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('🔻 Closing DB connection...');
    await mongoose.connection.close();
    process.exit(0);
  }
})();

// 941
// const testBatch = emailQueue.slice(0, 5);
// console.log('Emails to be sent in this batch:', testBatch.length);
// console.log('Email details for this batch:');
// testBatch.forEach((email) => {
//   console.log(`To: ${email.to}, StartDate: ${email.startDate}`);
// }); //replace for loop to send testBatch
