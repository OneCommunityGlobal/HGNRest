/**
 * Seeder: tasks collection
 * Generates 30 fake tasks with:
 * - Random WBS assignments
 * - Random users as resources
 * - Links
 * - Parent-child relationships
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Task = require('../models/task');
const UserProfile = require('../models/userProfile');
const Wbs = require('../models/wbs');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedTasks() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const existing = await Task.countDocuments();
    if (existing > 0) {
      console.log(`ℹ️ Task collection already has ${existing} documents. No seeding needed.`);
      return;
    }

    const users = await UserProfile.find({}, '_id firstName lastName profilePic');
    if (!users.length) {
      console.log('⚠️ No users found. Seed users first.');
      return;
    }

    const wbsList = await Wbs.find({}, '_id');
    if (!wbsList.length) {
      console.log('⚠️ No WBS entries found. Seed WBS first.');
      return;
    }

    const tasks = [];
    const now = new Date();

    for (let i = 1; i <= 30; i += 1) {
      const createdDatetime = new Date(now);
      createdDatetime.setDate(createdDatetime.getDate() - (30 - i));

      const selectedUsers = faker.helpers.arrayElements(
        users,
        faker.number.int({ min: 1, max: 3 }),
      );

      const resources = selectedUsers.map((u) => ({
        name: `${u.firstName} ${u.lastName}`,
        userID: u._id,
        profilePic: u.profilePic || '',
        completedTask: faker.datatype.boolean(),
        reviewStatus: faker.helpers.arrayElement(['Unsubmitted', 'Pending', 'Reviewed']),
      }));

      const randomWbs = faker.helpers.arrayElement(wbsList);

      const task = {
        taskName: `Task ${i}`,
        wbsId: randomWbs._id,
        num: `${i}`,
        level: faker.number.int({ min: 1, max: 4 }),
        priority: faker.helpers.arrayElement(['Primary', 'Secondary']),
        resources,
        isAssigned: true,
        status: faker.helpers.arrayElement(['Not Started', 'In Progress', 'Completed']),
        hoursBest: faker.number.float({ min: 0, max: 8, precision: 0.1 }),
        hoursWorst: faker.number.float({ min: 0, max: 8, precision: 0.1 }),
        hoursMost: faker.number.float({ min: 0, max: 8, precision: 0.1 }),
        hoursLogged: faker.number.float({ min: 0, max: 8, precision: 0.1 }),
        estimatedHours: faker.number.float({ min: 1, max: 8, precision: 0.1 }),
        startedDatetime: faker.date.past({ years: 1 }),
        dueDatetime: faker.date.future({ years: 1 }),
        links: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () =>
          faker.internet.url(),
        ),
        relatedWorkLinks: Array.from({ length: faker.number.int({ min: 0, max: 2 }) }, () =>
          faker.internet.url(),
        ),
        category: faker.commerce.department(),
        deadlineCount: faker.number.int({ min: 0, max: 5 }),
        parentId1: null,
        parentId2: null,
        parentId3: null,
        mother: null,
        position: i,
        isActive: true,
        hasChild: false,
        childrenQty: 0,
        createdDatetime,
        modifiedDatetime: new Date(),
        whyInfo: faker.lorem.sentence(),
        intentInfo: faker.lorem.sentence(),
        endstateInfo: faker.lorem.sentence(),
        classification: `Class ${(i % 3) + 1}`,
      };

      tasks.push(task);
    }

    const insertedTasks = await Task.insertMany(tasks);

    // Assign parents & children
    for (let i = 1; i < insertedTasks.length; i += 1) {
      const task = insertedTasks[i];

      // Randomly pick 0–2 parent tasks from already inserted ones
      const possibleParents = insertedTasks.slice(0, i);
      const numParents = faker.number.int({ min: 0, max: 2 });
      const selectedParents = faker.helpers.arrayElements(possibleParents, numParents);

      selectedParents.forEach((parentTask) => {
        if (!parentTask.hasChild) parentTask.hasChild = true;
        parentTask.childrenQty += 1;
        task.parentId1 = parentTask._id; // for simplicity, assign first parent only
        task.mother = parentTask._id; // set mother as the first parent
      });
    }

    // Update parent tasks in DB
    await Promise.all(insertedTasks.map((t) => Task.findByIdAndUpdate(t._id, t, { new: true })));

    console.log('🎉 Seeded 30 tasks with WBS, users, links, and parent-child relationships!');
  } catch (err) {
    console.error('❌ Error while seeding tasks:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedTasks();
