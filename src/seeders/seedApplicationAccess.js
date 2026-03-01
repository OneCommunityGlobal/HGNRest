/**
 * Seeder: applicationAccess collection
 * Creates fake app access records for existing users and links them in userProfile.
 */

const { faker } = require('@faker-js/faker');
const ApplicationAccess = require('../models/applicationAccess');
const UserProfile = require('../models/userProfile');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedApplicationAccess() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await ApplicationAccess.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ ApplicationAccess already has ${existing} entries. Skipping seeding.`);
      process.exit(0);
    }

    const users = await UserProfile.find({}, '_id');
    if (!users.length) {
      console.log('⚠️ No users found in userProfile collection. Please seed users first.');
      process.exit(1);
    }

    const appNames = [
      'TimeTracker',
      'EcoPlanner',
      'CarbonCalc',
      'TeamPortal',
      'VolunteerHub',
      'EnergyMonitor',
      'CommunityConnect',
      'GreenWallet',
    ];

    const statusOptions = ['invited', 'revoked', 'failed'];

    // Select about half the users for app access creation
    const selectedUsers = faker.helpers.arrayElements(users, Math.ceil(users.length / 2));

    const records = await Promise.all(
      selectedUsers.map(async (user) => {
        const numApps = faker.number.int({ min: 1, max: 4 });
        const apps = Array.from({ length: numApps }, () => {
          const status = faker.helpers.arrayElement(statusOptions);
          const invitedDate = faker.date.past({ years: 1 });
          let revokedDate = null;
          let failedReason = null;
          let credentials = null;

          if (status === 'revoked') revokedDate = faker.date.recent({ days: 60 });
          if (status === 'failed') {
            failedReason = faker.helpers.arrayElement([
              'Invalid credentials',
              'User not found',
              'Timeout during onboarding',
              'Missing permissions',
            ]);
          }
          if (status === 'invited') credentials = faker.internet.password({ length: 10 });

          return {
            app: faker.helpers.arrayElement(appNames),
            status,
            credentials,
            invitedOn: invitedDate,
            revokedOn: revokedDate,
            failedReason,
          };
        });

        const accessRecord = await ApplicationAccess.create({
          userId: user._id,
          apps,
        });

        // Update userProfile with reference
        await UserProfile.findByIdAndUpdate(
          user._id,
          { applicationAccess: accessRecord._id },
          { new: true },
        );

        return accessRecord;
      }),
    );

    console.log(`🔑 Successfully seeded ${records.length} ApplicationAccess records!`);
    console.log('🔗 Linked all created access records to corresponding userProfiles.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding applicationAccess:', err);
    process.exit(1);
  }
}

seedApplicationAccess();
