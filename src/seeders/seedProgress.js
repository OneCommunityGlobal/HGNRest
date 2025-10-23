const mongoose = require('mongoose');
const { dbConnect } = require('../test/db/mongo-helper');
const Progress = require('../models/progress');

async function seedProgress() {
  try {
    await dbConnect();

    const count = await Progress.countDocuments();
    if (count > 0) {
      console.log(`ℹ️ Progress collection already has ${count} documents. No seeding needed.`);
      process.exit(0);
    }

    // Create pools of dummy students and atoms to reference
    const studentIds = Array.from({ length: 12 }, () => new mongoose.Types.ObjectId());
    const atomIds = Array.from({ length: 20 }, () => new mongoose.Types.ObjectId());

    const statuses = ['not_started', 'in_progress', 'completed'];
    const grades = ['A', 'B', 'C', 'D', 'F', 'pending'];

    const entries = [];
    const seen = new Set();

    // Generate up to 200 unique student-atom progress documents (or fewer if pool small)
    for (let i = 0; i < 150; i += 1) {
      const student = studentIds[Math.floor(Math.random() * studentIds.length)];
      const atom = atomIds[Math.floor(Math.random() * atomIds.length)];
      const key = `${student.toString()}_${atom.toString()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const grade =
        status === 'completed'
          ? grades[Math.floor(Math.random() * (grades.length - 1))]
          : 'pending';

      // Generate timestamps depending on status
      let firstStartedAt;
      let completedAt;
      const now = new Date();
      if (status === 'in_progress' || status === 'completed') {
        firstStartedAt = new Date(now);
        firstStartedAt.setDate(now.getDate() - Math.floor(Math.random() * 30));
      }
      if (status === 'completed') {
        completedAt = new Date(firstStartedAt || now);
        completedAt.setDate(
          (firstStartedAt || now).getDate() + Math.max(1, Math.floor(Math.random() * 14)),
        );
      }

      entries.push({
        studentId: student,
        atomId: atom,
        status,
        firstStartedAt,
        completedAt,
        grade,
        feedback:
          Math.random() < 0.3
            ? `Auto-generated feedback for ${student.toString().slice(-4)}-${atom.toString().slice(-4)}`
            : undefined,
      });

      // Stop if we have a reasonable amount
      if (entries.length >= 100) break;
    }

    if (entries.length === 0) {
      console.log('⚠️ No progress entries generated (unexpected).');
      process.exit(0);
    }

    await Progress.insertMany(entries);
    console.log(`🎉 Seeded ${entries.length} progress documents successfully!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding progress:', err);
    process.exit(1);
  }
}

seedProgress();
