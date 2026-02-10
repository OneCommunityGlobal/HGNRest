/**
 * Seeder: wbs collection
 * - Generates WBS entries and links them to existing projects.
 */

const { faker } = require('@faker-js/faker');
const Wbs = require('../models/wbs');
const Project = require('../models/project');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedWbs() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await Wbs.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ WBS collection already has ${existing} documents. No seeding needed.`);
      process.exit(0);
    }

    // Fetch all projects
    const projects = await Project.find({}, '_id projectName');
    if (!projects.length) {
      console.log('⚠️ No projects found in project collection. Seed projects first.');
      process.exit(1);
    }

    const wbsEntries = [];

    projects.forEach((project) => {
      // Generate 2–5 WBS entries per project
      const numWbs = faker.number.int({ min: 2, max: 5 });

      for (let i = 1; i <= numWbs; i += 1) {
        const createdDate = faker.date.past({ years: 2 });
        const modifiedDate = faker.date.between({ from: createdDate, to: new Date() });

        wbsEntries.push({
          wbsName: `${project.projectName} - ${faker.word.adjective()} Phase ${i}`,
          projectId: project._id,
          isActive: faker.datatype.boolean(),
          createdDatetime: createdDate,
          modifiedDatetime: modifiedDate,
        });
      }
    });

    await Wbs.insertMany(wbsEntries);
    console.log(`🚀 Successfully seeded ${wbsEntries.length} WBS entries!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding WBS:', err);
    process.exit(1);
  }
}

seedWbs();
