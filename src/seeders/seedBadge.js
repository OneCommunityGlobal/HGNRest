/**
 * Seeder: badges collection
 * Generates 50 fake badges with realistic data.
 */

const { faker } = require('@faker-js/faker');
const Badge = require('../models/badge');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedBadges() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await Badge.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ Badges collection already has ${existing} entries. No seeding needed.`);
      process.exit(0);
    }

    const types = [
      'No Infringement Streak',
      'Minimum Hours Multiple',
      'Personal Max',
      'Most Hrs in Week',
      'X Hours for X Week Streak',
      'Lead a team of X+',
      'Total Hrs in Category',
      'Custom',
    ];

    const categories = [
      'Food',
      'Energy',
      'Housing',
      'Education',
      'Society',
      'Economics',
      'Stewardship',
      'Unassigned',
      'Other',
      'Unspecified',
    ];

    const badges = [];

    for (let i = 1; i <= 50; i += 1) {
      const type = faker.helpers.arrayElement(types);
      const category = faker.helpers.arrayElement(categories);

      badges.push({
        badgeName: faker.helpers.arrayElement([
          `Excellence in ${category}`,
          `${faker.word.adjective()} ${category} Champion`,
          `${category} Contributor ${faker.number.int({ min: 1, max: 5 })}`,
          `${faker.word.adjective()} Performer`,
          `Team ${faker.word.noun()} Award`,
        ]),
        type,
        multiple: faker.number.int({ min: 1, max: 10 }),
        weeks: faker.number.int({ min: 1, max: 52 }),
        months: faker.number.int({ min: 1, max: 12 }),
        totalHrs: faker.number.int({ min: 10, max: 500 }),
        people: faker.number.int({ min: 1, max: 20 }),
        category,
        project: null, // leave null unless you want to reference real projects
        imageUrl: faker.image.url(),
        ranking: faker.number.int({ min: 1, max: 10 }),
        description: faker.lorem.sentence(),
        showReport: faker.datatype.boolean(),
      });
    }

    await Badge.insertMany(badges);
    console.log('🏅 Successfully seeded 50 fake badges!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding badges:', err);
    process.exit(1);
  }
}

seedBadges();
