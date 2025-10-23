const mongoose = require('mongoose');
const { dbConnect } = require('../test/db/mongo-helper');
const Task = require('../models/task');

async function seedTasks() {
  try {
    await dbConnect();

    const count = await Task.countDocuments();
    if (count > 0) {
      console.log(`ℹ️ Task collection already has ${count} documents. No seeding needed.`);
      process.exit(0);
    }

    const dummyWbsId = new mongoose.Types.ObjectId();
    const dummyUserId = new mongoose.Types.ObjectId();

    const tasks = [];
    const now = new Date();

    for (let i = 1; i <= 30; i += 1) {
      const createdDatetime = new Date(now);
      createdDatetime.setDate(createdDatetime.getDate() - (30 - i));

      tasks.push({
        taskName: `Task ${i}`,
        wbsId: dummyWbsId,
        num: `${i}`,
        level: (i % 4) + 1,
        priority: i % 3 === 0 ? 'Secondary' : 'Primary',
        resources: [
          {
            name: `Resource ${i}-A`,
            userID: dummyUserId,
            profilePic: '',
            completedTask: false,
            reviewStatus: 'Unsubmitted',
          },
        ],
        isAssigned: true,
        status: 'Not Started',
        hoursBest: 0.0,
        hoursWorst: 0.0,
        hoursMost: 0.0,
        hoursLogged: 0.0,
        estimatedHours: 1.0 + (i % 5),
        startedDatetime: null,
        dueDatetime: (() => {
          const d = new Date(createdDatetime);
          d.setDate(d.getDate() + 7 + (i % 5));
          return d;
        })(),
        links: [],
        relatedWorkLinks: [],
        category: `Category ${(i % 5) + 1}`,
        deadlineCount: 0,
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
        whyInfo: `Why info for task ${i}`,
        intentInfo: `Intent info for task ${i}`,
        endstateInfo: `Endstate info for task ${i}`,
        classification: `Class ${(i % 3) + 1}`,
      });
    }

    await Task.insertMany(tasks);
    console.log('🎉 Seeded 30 tasks successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding tasks:', err);
    process.exit(1);
  }
}

seedTasks();
