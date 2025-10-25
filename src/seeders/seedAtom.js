const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const { dbConnect } = require('../test/db/mongo-helper'); // Adjust path if needed
const Atom = require('../models/atom'); // Adjust path if needed
const Subject = require('../models/subject'); // Adjust path if needed

async function seedAtoms() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existingCount = await Atom.countDocuments();
    if (existingCount > 0) {
      console.log(`ℹ️ Atom collection already has ${existingCount} documents. No seeding needed.`);
      process.exit(0);
    }

    // Fetch all subjects
    const subjects = await Subject.find({}, '_id atomIds');
    if (!subjects.length) {
      console.log('⚠️ No subjects found. Please seed subjects first.');
      process.exit(1);
    }

    const difficulties = ['beginner', 'intermediate', 'advanced'];
    const atoms = [];

    for (let i = 1; i <= 20; i += 1) {
      // Pick a random subject
      const subject = faker.helpers.arrayElement(subjects);

      const newAtom = new Atom({
        subjectId: subject._id,
        name: `Atom ${i}`,
        description: faker.lorem.sentence(),
        difficulty: difficulties[i % difficulties.length],
        prerequisites: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        learningStrategies: [`Strategy ${i}A`, `Strategy ${i}B`],
        learningTools: [`Tool ${i}A`, `Tool ${i}B`],
      });

      atoms.push(newAtom);

      // Update the subject to include this atom's ID
      subject.atomIds.push(newAtom._id);
    }

    // Insert all atoms
    await Atom.insertMany(atoms);

    // Save updated subjects
    await Promise.all(subjects.map((subj) => subj.save()));

    console.log('🎉 Seeded 20 atoms and updated subjects successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding atoms:', err);
    process.exit(1);
  }
}

seedAtoms();
