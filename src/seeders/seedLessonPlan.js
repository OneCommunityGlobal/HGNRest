/**
 * Seeder: lessonPlan collection
 * Generates 20 fake lesson plans with random users as creators
 * and dummy activity IDs.
 */

const { faker } = require('@faker-js/faker');
const LessonPlan = require('../models/lessonPlan');
const UserProfile = require('../models/userProfile');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedLessonPlans() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await LessonPlan.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ LessonPlan collection already has ${existing} documents. No seeding needed.`);
      process.exit(0);
    }

    const users = await UserProfile.find({}, '_id');
    if (!users.length) {
      console.log('⚠️ No users found. Seed users first.');
      process.exit(1);
    }

    const lessonPlans = [];

    for (let i = 1; i <= 20; i += 1) {
      const startDate = faker.date.future({ years: 1 });
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + faker.number.int({ min: 1, max: 30 }));

      // Pick a random user as creator
      const createdBy = faker.helpers.arrayElement(users)._id;
      lessonPlans.push({
        title: `${faker.word.adjective()} ${faker.word.noun()} Lesson Plan ${i}`,
        theme: faker.word.adjective(),
        description: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
        startDate,
        endDate,
        createdBy,
      });
    }

    await LessonPlan.insertMany(lessonPlans);
    console.log('🎉 Successfully seeded 20 lesson plans!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding lesson plans:', err);
    process.exit(1);
  }
}

seedLessonPlans();
