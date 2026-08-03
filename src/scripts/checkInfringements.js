const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');

async function connect() {
  await mongoose.connect(process.env.DB_URL || process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

async function checkInfringementsRaw() {
  const totalUsers = await UserProfile.countDocuments({});
  const usersWithInfringementsField = await UserProfile.countDocuments({
    infringements: { $exists: true },
  });
  const usersWithNonEmptyInfringements = await UserProfile.countDocuments({
    'infringements.0': { $exists: true },
  });

  console.log('Total users:', totalUsers);
  console.log('Users with infringements field:', usersWithInfringementsField);
  console.log('Users with at least 1 infringement:', usersWithNonEmptyInfringements);

  const example = await UserProfile.findOne(
    { 'infringements.0': { $exists: true } },
    { infringements: 1 },
  );
  console.log('Example doc:', JSON.stringify(example, null, 2));
}

async function checkInfringementDatesSpread() {
  const results = await UserProfile.aggregate([
    { $unwind: '$infringements' },
    { $project: { date: '$infringements.date', description: '$infringements.description' } },
    { $sort: { date: -1 } },
    { $limit: 20 },
  ]);
  console.log(JSON.stringify(results, null, 2));
}

(async function run() {
  await connect();
  await checkInfringementsRaw();
  await checkInfringementDatesSpread();
  await mongoose.disconnect();
})();
