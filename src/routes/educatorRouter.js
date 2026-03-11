/* eslint-disable no-plusplus */
const express = require('express');

const router = express.Router();

// --- Step 1: Import Your Real Mongoose Models ---
// NOTE: Adjust the paths to match your project's file structure.
// It's common for models to be in a directory like '../models/'
const LessonPlan = require('../models/lessonPlan'); // Assuming you have a LessonPlan model
const EducationTask = require('../models/educationTask'); // Assuming you have a Task model for assignments
const UserProfile = require('../models/userProfile'); // Using UserProfile as the "Student" model
const LessonPlanLog = require('../models/lessonPlanLog');
// --- Step 2: Import Your Authentication Middleware ---
// NOTE: You will have a file that handles user authentication.
// This middleware will run before your route logic to protect it.
// const authMiddleware = require('../middleware/auth'); // Example path

/**
 * @route   POST /api/educator/assign-tasks
 * @desc    Assigns all tasks from a lesson plan to eligible students.
 * @access  Private (Protected by authentication middleware)
 */
// To protect this route, you would add your middleware like this:
// router.post('/assign-tasks', authMiddleware, async (req, res) => {
router.post('/assign-tasks', async (req, res) => {
  // 1. Destructure the payload from the frontend request body
  const { lessonPlanId, assignmentDate, isAutoAssigned } = req.body;

  // --- Basic Validation ---
  if (!lessonPlanId) {
    return res.status(400).json({ message: 'Request is missing lesson_plan_id.' });
  }

  console.log(
    `Assigning tasks for Lesson Plan ID: ${lessonPlanId}, Auto-assigned: ${isAutoAssigned}`,
  );

  try {
    // --- Real Backend Logic ---

    // a. Find the lesson plan in the database to get its details
    const lessonPlan = await LessonPlan.findById(lessonPlanId);
    // .populate('subTasks'); // Assuming subTasks are referenced
    // console.log('--- INSPECTING LESSON PLAN OBJECT ---');
    // console.log(JSON.stringify(lessonPlan, null, 2));
    // console.log('--- END INSPECTION ---');

    if (!lessonPlan || !lessonPlan.subTasks || lessonPlan.subTasks.length === 0) {
      return res
        .status(404)
        .json({ message: 'Lesson plan not found or it has no sub-tasks to assign.' });
    }

    // b. Find all students who should receive the tasks.
    // This query finds all active, non-admin users. You can customize it.
    const eligibleStudents = await UserProfile.find({
      // isActive: { $ne: false }, // Includes true or undefined, exclude false
      isActive: true,
      // role: { $exists: true, $nin: ['Administrator', 'Owner', 'Manager'] } // Ensure role exists and is not admin/owner/manager
      role: { $nin: ['Administrator', 'Owner', 'Manager'] },
    });

    if (!eligibleStudents || eligibleStudents.length === 0) {
      return res.status(404).json({ message: 'No eligible students found to assign tasks to.' });
    }

    let assignedCount = 0;
    let skippedCount = 0;
    const tasksToCreate = [];

    // Get the ID of the educator who is assigning the task
    const assignerId = req.body.requestor.requestorId;

    // c. Loop through each student and prepare the tasks for creation
    eligibleStudents.forEach((student) => {
      const meetsPrerequisites = true; // Placeholder for your logic

      //   if (meetsPrerequisites) {
      //     // FIXED: The logic now correctly iterates over lessonPlan.subTasks
      //     if (lessonPlan.subTasks && lessonPlan.subTasks.length > 0) {
      //         lessonPlan.subTasks.forEach(subTask => {
      //             tasksToCreate.push({
      //                 studentId: student._id,
      //                 lessonPlanId,
      //                 // FIXED: Use the 'title' property from the subTask
      //                 title: subTask.name,
      //                 assignedDate: assignmentDate,
      //                 dueDate: subTask.dueDate,
      //                 status: 'Assigned',
      //             });
      //         });
      //         assignedCount++;
      //     } else {
      //         // If the lesson plan has no subtasks, we consider it "skipped" for this student.
      //         skippedCount++;
      //     }
      //   } else {
      //     skippedCount++;
      //   }
      if (meetsPrerequisites) {
        // Ensure subTasks array exists and has items before proceeding
        if (lessonPlan.subTasks && lessonPlan.subTasks.length > 0) {
          lessonPlan.subTasks.forEach((subTask) => {
            // Additional check: Ensure subTask.name exists before creating task
            // if (subTask && subTask.name) {
            tasksToCreate.push({
              studentId: student._id,
              lessonPlanId,
              title: subTask.name,
              assignedDate: assignmentDate,
              dueDate: subTask.dueDate, // Optional: Add default if missing?
              status: 'Assigned',
              // Saving the ID of the educator who triggered the assignment
              assignedBy: assignerId,
            });
            // }
            // else {
            //   console.warn(`Skipping subTask for student ${student._id} due to missing name in lesson plan ${lessonPlanId}`);
            // }
          });
          assignedCount++;
        } else {
          // This case should technically be caught by the initial lessonPlan check, but good to handle defensively.
          console.warn(`Lesson plan ${lessonPlanId} has no subTasks for student ${student._id}.`);
          skippedCount++; // Count student as skipped if lesson plan has no tasks
        }
      } else {
        skippedCount++;
      }
    });

    // d. Use bulk insert to efficiently create all tasks in the database
    if (tasksToCreate.length > 0) {
      await EducationTask.insertMany(tasksToCreate);
      console.log(`Successfully inserted ${tasksToCreate.length} tasks into the database.`);
    }
    // else {
    //   console.log('No tasks needed to be created.');
    // }

    // --- NEW: CREATING THE LOG ENTRY HERE---
    // This creates a new document in the 'lessonplanlogs' collection
    await LessonPlanLog.create({
      lessonPlanId,
      editorId: assignerId,
      action: isAutoAssigned ? 'Auto-Assigned (On Save)' : 'Manual Assignment',
      details: `Assigned to ${assignedCount} students. Skipped ${skippedCount}.`,
    });

    // 2. Send the final, successful response back to the frontend
    console.log(
      `Successfully assigned tasks to ${assignedCount} students. Skipped ${skippedCount}.`,
    );
    res.status(200).json({
      assignedCount,
      skippedCount,
    });
  } catch (error) {
    // --- REFINED ERROR LOGGING ---
    console.error('-----------------------------------------');
    console.error('Error occurred in /api/educator/assign-tasks:');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Request Body:', req.body); // Log incoming data
    console.error('Error Details:', error); // Log the full error object
    console.error('-----------------------------------------');

    // Send a generic error message to the frontend in production
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred while assigning tasks.'
        : `An internal server error occurred: ${error.message}`; // More detail in dev

    res.status(500).json({ message: errorMessage });
  }
});

/**
 * @route   GET /api/educator/logs/:lessonPlanId
 * @desc    Get all assignment/edit logs for a specific lesson plan
 * @access  Private
 */
router.get('/logs/:lessonPlanId', async (req, res) => {
  try {
    const logs = await LessonPlanLog.find({ lessonPlanId: req.params.lessonPlanId })
      // 'populate' fetches the editor's name from the 'userProfile' collection
      .populate('editorId', 'firstName lastName email')
      .sort({ logDateTime: -1 }); // Show newest first
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching lesson plan logs:', error);
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

module.exports = router;
