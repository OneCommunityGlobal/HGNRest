/**
 * Seeder: subjects collection
 * Creates sample Subject documents without atom references.
 */

const { faker } = require('@faker-js/faker');
const Subject = require('../models/subject');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedSubjects() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await Subject.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ Subjects collection already has ${existing} entries. No seeding needed.`);
      process.exit(0);
    }

    const subjectNames = [
      'Mathematics',
      'Physics',
      'Chemistry',
      'Biology',
      'History',
      'Geography',
      'Economics',
      'Sociology',
      'Philosophy',
      'Computer Science',
      'Political Science',
      'Psychology',
      'Statistics',
      'Environmental Science',
      'Art & Design',
      'Music',
      'Literature',
      'Business Studies',
      'Engineering',
      'Health Science',
    ];

    const subjects = subjectNames.map((name, i) => ({
      name,
      iconUrl: faker.image.url(),
      sequence: i + 1,
      description: faker.lorem.sentence(),
      atomIds: [], // empty array, no atoms linked
    }));

    await Subject.insertMany(subjects);
    console.log(`📚 Successfully seeded ${subjects.length} subjects!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding subjects:', err);
    process.exit(1);
  }
}

seedSubjects();
