/**
 * Migration Script: Add categoryLocked field to existing tasks
 *
 * This script adds the categoryLocked field to all existing tasks.
 *
 * Logic:
 * - Tasks where category matches project category → categoryLocked: false (can cascade)
 * - Tasks where category differs from project category → categoryLocked: true (locked by user choice)
 * - Also updates categoryOverride to match the current state
 */

const mongoose = require('mongoose');
const Task = require('./src/models/task');
const WBS = require('./src/models/wbs');
const Project = require('./src/models/project');
const encodeMongoPassword = require('./src/utilities/mongoPasswordEncoder');
require('dotenv').config();

// Connect to MongoDB
const uri = `mongodb+srv://${process.env.user}:${encodeMongoPassword(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;

mongoose.connect(uri);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));

db.once('open', async () => {
  console.log('✓ Connected to MongoDB\n');
  console.log('='.repeat(70));
  console.log('MIGRATION: Add categoryLocked field to existing tasks');
  console.log('='.repeat(70));
  console.log();

  try {
    // Get all tasks that don't have categoryLocked field
    const tasksToMigrate = await Task.find({
      categoryLocked: { $exists: false },
    }).select('_id taskName category wbsId');

    console.log(`Found ${tasksToMigrate.length} tasks to migrate\n`);

    if (tasksToMigrate.length === 0) {
      console.log('✓ All tasks already have categoryLocked field. Migration not needed.\n');
      process.exit(0);
    }

    let processedCount = 0;
    let lockedCount = 0;
    let unlockedCount = 0;
    const bulkOps = [];

    console.log('Processing tasks...\n');

    // Process tasks sequentially
    // eslint-disable-next-line no-restricted-syntax
    for (const task of tasksToMigrate) {
      processedCount += 1;

      if (processedCount % 100 === 0) {
        console.log(`  Processed ${processedCount}/${tasksToMigrate.length} tasks...`);
      }

      try {
        // Get WBS and Project for this task
        // eslint-disable-next-line no-await-in-loop
        const wbs = await WBS.findById(task.wbsId).select('projectId');
        // eslint-disable-next-line no-continue
        if (!wbs) continue;

        // eslint-disable-next-line no-await-in-loop
        const project = await Project.findById(wbs.projectId).select('category');
        // eslint-disable-next-line no-continue
        if (!project) continue;

        const taskCategory = task.category || 'Unspecified';
        const projectCategory = project.category || 'Unspecified';

        let categoryLocked;
        let categoryOverride;

        if (taskCategory === projectCategory) {
          // Task matches project - unlocked so it can cascade
          categoryLocked = false;
          categoryOverride = false;
          unlockedCount += 1;
        } else {
          // Task differs from project - locked (user chose this category)
          categoryLocked = true;
          categoryOverride = true;
          lockedCount += 1;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: task._id },
            update: {
              $set: {
                categoryLocked,
                categoryOverride,
              },
            },
          },
        });
      } catch (err) {
        console.error(`  Error processing task ${task._id}:`, err.message);
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    console.log(`\n  Processed ${processedCount} tasks`);
    console.log(`  - ${unlockedCount} will be unlocked (can cascade)`);
    console.log(`  - ${lockedCount} will be locked (user override)`);
    console.log();

    if (bulkOps.length > 0) {
      console.log('Applying updates to database...');
      const result = await Task.bulkWrite(bulkOps);
      console.log(`✓ Updated ${result.modifiedCount} tasks\n`);

      // Verify with sample
      const sampleTasks = await Task.find({
        categoryLocked: { $exists: true },
      })
        .limit(5)
        .select('taskName category categoryOverride categoryLocked');

      console.log('Sample of migrated tasks:');
      sampleTasks.forEach((t) => {
        console.log(
          `  - "${t.taskName}": category="${t.category}", override=${t.categoryOverride}, locked=${t.categoryLocked}`,
        );
      });
      console.log();
    }

    console.log('='.repeat(70));
    console.log('✓ MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log();
    console.log('Summary:');
    console.log(`  - Total tasks processed: ${processedCount}`);
    console.log(`  - Unlocked tasks (will cascade): ${unlockedCount}`);
    console.log(`  - Locked tasks (user override): ${lockedCount}`);
    console.log();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
    process.exit(0);
  }
});
