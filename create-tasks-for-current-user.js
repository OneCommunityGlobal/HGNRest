const mongoose = require('mongoose');
const EducationTask = require('./src/models/educationTask');
const LessonPlan = require('./src/models/lessonPlan');
const Subject = require('./src/models/subject');
const Atom = require('./src/models/atom');
const UserProfile = require('./src/models/userProfile');

async function createTasksForCurrentUser() {
  try {
    require('dotenv').config();

    const uri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    const currentUserId = '6866df6dcd4512004ec6cbb6';

    // Get existing data
    const subjects = await Subject.find({});
    const atoms = await Atom.find({});
    const lessonPlans = await LessonPlan.find({});
    const students = await UserProfile.find({});

    console.log(`Found: ${subjects.length} subjects, ${atoms.length} atoms, ${lessonPlans.length} lesson plans, ${students.length} students`);

    if (subjects.length === 0 || atoms.length === 0 || lessonPlans.length === 0 || students.length === 0) {
      console.log('❌ Missing data. Need subjects, atoms, lesson plans, and students!');
      return;
    }

    // Delete existing education tasks for current user
    await EducationTask.deleteMany({ studentId: currentUserId });

    // Create new education tasks for current user
    const educationTasks = await EducationTask.create([
      {
        lessonPlanId: lessonPlans[0]._id,
        studentId: currentUserId,
        atomIds: [atoms[0]._id, atoms[1]._id],
        type: 'read',
        status: 'in_progress',
        assignedAt: new Date(),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        uploadUrls: [],
        grade: 'pending',
        feedback: null,
        suggestedTotalHours: 2,
        loggedHours: 0.5
      },
      {
        lessonPlanId: lessonPlans[1] ? lessonPlans[1]._id : lessonPlans[0]._id,
        studentId: currentUserId,
        atomIds: [atoms[2] ? atoms[2]._id : atoms[0]._id],
        type: 'write',
        status: 'completed',
        assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        uploadUrls: ['https://example.com/assignment1.pdf'],
        grade: 'A',
        feedback: 'Excellent work! Great understanding of the concepts.',
        suggestedTotalHours: 3,
        loggedHours: 3
      },
      {
        lessonPlanId: lessonPlans[2] ? lessonPlans[2]._id : lessonPlans[0]._id,
        studentId: currentUserId,
        atomIds: [atoms[3] ? atoms[3]._id : atoms[0]._id, atoms[4] ? atoms[4]._id : atoms[1]._id],
        type: 'practice',
        status: 'assigned',
        assignedAt: new Date(),
        dueAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        uploadUrls: [],
        grade: 'pending',
        feedback: null,
        suggestedTotalHours: 4,
        loggedHours: 0
      },
      {
        lessonPlanId: lessonPlans[0]._id,
        studentId: currentUserId,
        atomIds: [atoms[5] ? atoms[5]._id : atoms[0]._id],
        type: 'quiz',
        status: 'graded',
        assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        uploadUrls: [],
        grade: 'B',
        feedback: 'Good effort, but review the algebraic concepts.',
        suggestedTotalHours: 1,
        loggedHours: 1
      },
      {
        lessonPlanId: lessonPlans[1] ? lessonPlans[1]._id : lessonPlans[0]._id,
        studentId: currentUserId,
        atomIds: [
          atoms[6] ? atoms[6]._id : atoms[1]._id, 
          atoms[7] ? atoms[7]._id : (atoms[2] || atoms[0])._id
        ],
        type: 'project',
        status: 'assigned',
        assignedAt: new Date(),
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        uploadUrls: [],
        grade: 'pending',
        feedback: null,
        suggestedTotalHours: 8,
        loggedHours: 0
      }
    ]);

    console.log(`✅ Created ${educationTasks.length} education tasks for current user`);
    console.log('🎯 Now try the API again!');
    
    // Log the created tasks for verification
    educationTasks.forEach((task, index) => {
      console.log(`Task ${index + 1}: ${task.type} - ${task.status} - Due: ${task.dueAt.toDateString()}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createTasksForCurrentUser();