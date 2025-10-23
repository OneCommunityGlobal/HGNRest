const mongoose = require('mongoose');
const { dbConnect } = require('../test/db/mongo-helper'); // Adjust path if needed
const LessonPlan = require('../models/lessonPlan'); // Adjust path if needed

async function seedLessonPlans() {
  try {
    await dbConnect();

    const count = await LessonPlan.countDocuments();
    if (count > 0) {
      console.log(`ℹ️ LessonPlan collection already has ${count} documents. No seeding needed.`);
      process.exit(0);
    }

    const dummyUserId = new mongoose.Types.ObjectId();
    const dummyActivityIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

    const lessonPlans = [];
    for (let i = 1; i <= 20; i += 1) {
      const start = new Date();
      start.setDate(start.getDate() + i);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      lessonPlans.push({
        title: `Lesson Plan ${i}`,
        theme: `Theme ${i}`,
        description: `Description for lesson plan ${i}`,
        startDate: start,
        endDate: end,
        createdBy: dummyUserId,
        activities: dummyActivityIds,
      });
    }

    await LessonPlan.insertMany(lessonPlans);
    console.log('🎉 Seeded 20 lesson plans successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding lesson plans:', err);
    process.exit(1);
  }
}

seedLessonPlans();
