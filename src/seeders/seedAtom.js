const mongoose = require('mongoose');
const { dbConnect } = require('../test/db/mongo-helper'); // Adjust path if needed
const Atom = require('../models/atom'); // Adjust path if needed

async function seedAtoms() {
  try {
    await dbConnect();

    const count = await Atom.countDocuments();
    if (count > 0) {
      console.log(`ℹ️ Atom collection already has ${count} documents. No seeding needed.`);
      process.exit(0);
    }

    const dummySubjectId = new mongoose.Types.ObjectId();
    const dummyPrereqIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

    const atoms = [];
    const difficulties = ['beginner', 'intermediate', 'advanced'];

    for (let i = 1; i <= 20; i += 1) {
      atoms.push({
        subjectId: dummySubjectId,
        name: `Atom ${i}`,
        description: `Description for atom ${i}`,
        difficulty: difficulties[i % difficulties.length],
        prerequisites: dummyPrereqIds,
        learningStrategies: [`Strategy ${i}A`, `Strategy ${i}B`],
        learningTools: [`Tool ${i}A`, `Tool ${i}B`],
      });
    }

    await Atom.insertMany(atoms);
    console.log('🎉 Seeded 20 atoms successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding atoms:', err);
    process.exit(1);
  }
}

seedAtoms();
