const mongoose = require('mongoose');
const { dbConnect } = require('../test/db/mongo-helper');
const Subject = require('../models/subject');

async function seedSubjects() {
  try {
    await dbConnect();

    const count = await Subject.countDocuments();
    if (count > 0) {
      console.log(`ℹ️ Subject collection already has ${count} documents. No seeding needed.`);
      process.exit(0);
    }

    // Create some dummy atom ObjectIds
    const dummyAtomIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

    const subjects = [];
    for (let i = 1; i <= 10; i += 1) {
      subjects.push({
        name: `Subject ${i}`,
        iconUrl: `https://example.com/icon${i}.png`,
        sequence: i,
        description: `Description for subject ${i}`,
        atomIds: dummyAtomIds,
      });
    }

    await Subject.insertMany(subjects);
    console.log('🎉 Seeded 10 subjects successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding subjects:', err);
    process.exit(1);
  }
}

seedSubjects();
