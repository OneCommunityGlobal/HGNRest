/**
 * Seeder: teams collection
 * Generates fake teams and links members from existing userProfile records.
 */

const { faker } = require('@faker-js/faker');
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedTeams() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await Team.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ Teams collection already has ${existing} entries. Skipping seeding.`);
      process.exit(0);
    }

    const users = await UserProfile.find({}, '_id');
    if (!users.length) {
      console.log('⚠️ No users found in userProfile collection. Please seed users first.');
      process.exit(1);
    }

    const teams = [];
    const numTeams = 20; // create 20 teams

    for (let i = 0; i < numTeams; i += 1) {
      const numMembers = faker.number.int({ min: 3, max: 10 });
      const selectedUsers = faker.helpers.arrayElements(users, numMembers);

      const members = selectedUsers.map((u) => ({
        userId: u._id,
        addDateTime: faker.date.past({ years: 1 }),
        visible: faker.datatype.boolean(),
      }));

      const team = await Team.create({
        teamName: faker.helpers.arrayElement([
          `${faker.color.human()} ${faker.word.noun()} Team`,
          `${faker.company.name()} Crew`,
          `${faker.word.adjective()} Innovators`,
          `Team ${faker.word.noun()}`,
          `${faker.word.adjective()} Builders`,
        ]),
        isActive: faker.datatype.boolean(),
        createdDatetime: faker.date.past({ years: 2 }),
        modifiedDatetime: faker.date.recent({ days: 90 }),
        members,
        teamCode: faker.string
          .alphanumeric({ length: faker.number.int({ min: 5, max: 7 }) })
          .toUpperCase(),
      });

      teams.push(team);

      // 🔗 Update each user's 'teams' field with this team ID
      await Promise.all(
        selectedUsers.map((u) =>
          UserProfile.findByIdAndUpdate(
            u._id,
            { $addToSet: { teams: team._id } }, // addToSet avoids duplicates
            { new: true },
          ),
        ),
      );
    }

    console.log(`👥 Successfully seeded ${teams.length} teams and linked users!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding teams:', err);
    process.exit(1);
  }
}

seedTeams();
