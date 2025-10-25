/**
 * Seeder: progress collection
 * Generates progress records linking students and atoms.
 */

const { faker } = require('@faker-js/faker');
const Progress = require('../models/progress');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedProgress() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await Progress.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ Progress collection already has ${existing} entries. No seeding needed.`);
      process.exit(0);
    }

    // Fetch students and atoms
    const students = await UserProfile.find({}, '_id');
    const atoms = await Atom.find({}, '_id');

    if (!students.length || !atoms.length) {
      console.log('⚠️ No students or atoms found. Please seed userProfiles and atoms first.');
      process.exit(1);
    }

    const statuses = ['not_started', 'in_progress', 'completed'];
    const grades = ['A', 'B', 'C', 'D', 'F', 'pending'];

    const progressRecords = [];

    // For each student, assign a random subset of atoms
    students.forEach((student) => {
      const assignedAtoms = faker.helpers.arrayElements(
        atoms,
        faker.number.int({ min: 3, max: 10 }),
      );

      assignedAtoms.forEach((atom) => {
        const status = faker.helpers.arrayElement(statuses);
        let firstStartedAt = null;
        let completedAt = null;

        if (status === 'in_progress' || status === 'completed') {
          firstStartedAt = faker.date.past({ years: 1 });
        }

        if (status === 'completed') {
          completedAt = faker.date.between({ from: firstStartedAt, to: new Date() });
        }

        const grade =
          status === 'completed' ? faker.helpers.arrayElement(grades.slice(0, 5)) : 'pending';

        progressRecords.push({
          studentId: student._id,
          atomId: atom._id,
          status,
          firstStartedAt,
          completedAt,
          grade,
          feedback: faker.lorem.sentence(),
        });
      });
    });

    await Progress.insertMany(progressRecords);
    console.log(`🎉 Successfully seeded ${progressRecords.length} progress records!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding progress:', err);
    process.exit(1);
  }
}

seedProgress();
