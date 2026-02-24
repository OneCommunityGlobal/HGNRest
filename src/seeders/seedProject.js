/**
 * Seeder: projects collection
 * Generates 50 fake projects with realistic metadata,
 * and assigns them to random users in userProfile.projects.
 */

const { faker } = require('@faker-js/faker');
const Project = require('../models/project');
const UserProfile = require('../models/userProfile');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedProjects() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await Project.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ Projects collection already has ${existing} entries. No seeding needed.`);
      process.exit(0);
    }

    const categories = [
      'Food',
      'Energy',
      'Housing',
      'Education',
      'Society',
      'Economics',
      'Stewardship',
      'Other',
      'Unspecified',
    ];

    const projects = [];

    // Create 50 projects
    for (let i = 1; i <= 50; i += 1) {
      const category = faker.helpers.arrayElement(categories);
      const createdDate = faker.date.past({ years: 2 });
      const modifiedDate = faker.date.between({ from: createdDate, to: new Date() });

      projects.push({
        projectName: faker.helpers.arrayElement([
          `${category} Initiative ${i}`,
          `${faker.company.name()} ${category} Project`,
          `Project ${faker.word.adjective()} ${category}`,
          `${faker.word.adjective()} ${category} Drive`,
          `${category} Mission ${faker.number.int({ min: 1, max: 999 })}`,
        ]),
        isActive: faker.datatype.boolean(),
        isArchived: faker.datatype.boolean(),
        createdDatetime: createdDate,
        modifiedDatetime: modifiedDate,
        membersModifiedDatetime: faker.date.between({ from: createdDate, to: modifiedDate }),
        inventoryModifiedDatetime: faker.date.between({ from: createdDate, to: modifiedDate }),
        category,
      });
    }

    const insertedProjects = await Project.insertMany(projects);
    console.log(`🚀 Successfully seeded ${insertedProjects.length} fake projects!`);

    // Fetch all user profiles
    const users = await UserProfile.find({}, '_id projects');
    if (!users.length) {
      console.log('⚠️ No users found in userProfile collection. Seed users first.');
      process.exit(0);
    }

    // Assign random projects to users
    await Promise.all(
      users.map(async (user) => {
        const randomProjects = faker.helpers.arrayElements(
          insertedProjects,
          faker.number.int({ min: 1, max: 3 }), // Each user gets 1–3 projects
        );

        const projectIds = randomProjects.map((p) => p._id);
        user.projects = projectIds;
        await user.save();
      }),
    );

    console.log(`👤 Assigned projects to ${users.length} users successfully!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding projects:', err);
    process.exit(1);
  }
}

seedProjects();
