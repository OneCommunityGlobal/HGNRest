const mongoose = require('mongoose');
const StudentTask = require('./src/models/studentTask');
const Subject = require('./src/models/subject');
const Atom = require('./src/models/atom');
const Strategy = require('./src/models/strategy');
const Task = require('./src/models/task');

async function createTasksForCurrentUser() {
  try {
    require('dotenv').config();

    const uri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    const currentUserId = '6761ddebbca83a004d6976be';

    // Get existing data
    const subjects = await Subject.find({});
    const atoms = await Atom.find({});
    const strategies = await Strategy.find({});
    const tasks = await Task.find({});

    console.log(`Found: ${subjects.length} subjects, ${atoms.length} atoms, ${strategies.length} strategies, ${tasks.length} tasks`);

    if (subjects.length === 0 || atoms.length === 0 || strategies.length === 0 || tasks.length === 0) {
      console.log('❌ Missing data. Run seed.js first!');
      return;
    }

    // Delete existing student tasks for current user
    await StudentTask.deleteMany({ student_id: currentUserId });

    // Create new student tasks for current user
    const studentTasks = await StudentTask.create([
      {
        student_id: currentUserId,
        task_id: tasks[0]._id,
        status: 'in_progress',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        subject_id: subjects[0]._id,
        atom_id: atoms[0]._id,
        activity_group_id: strategies[0]._id,
        teaching_strategy_id: strategies[3]._id,
        life_strategy_id: strategies[5]._id,
        progress_percent: 25
      },
      {
        student_id: currentUserId,
        task_id: tasks[1]._id,
        status: 'completed',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        subject_id: subjects[1]._id,
        atom_id: atoms[1]._id,
        activity_group_id: strategies[1]._id,
        teaching_strategy_id: strategies[4]._id,
        life_strategy_id: strategies[5]._id,
        progress_percent: 100
      },
      {
        student_id: currentUserId,
        task_id: tasks[2]._id,
        status: 'not_started',
        due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        subject_id: subjects[2]._id,
        atom_id: atoms[2]._id,
        activity_group_id: strategies[2]._id,
        teaching_strategy_id: strategies[3]._id,
        life_strategy_id: strategies[6]._id,
        progress_percent: 0
      }
    ]);

    console.log(`✅ Created ${studentTasks.length} student tasks for current user`);
    console.log('🎯 Now try the API again!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createTasksForCurrentUser();