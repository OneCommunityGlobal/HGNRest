/* eslint-disable import/order */
/* eslint-disable no-console */
/* eslint-disable no-plusplus */
const express = require('express');

const router = express.Router();
const educatorController = require('../controllers/educatorController');

const controller = educatorController();

const LessonPlan = require('../models/lessonPlan'); 
const EducationTask = require('../models/educationTask');
const UserProfile = require('../models/userProfile');
const LessonPlanLog = require('../models/lessonPlanLog');


/**
 * @route   POST /api/educator/assign-tasks
 * @desc    Assigns all tasks from a lesson plan to eligible students.
 * @access  Private (Protected by authentication middleware)
 */
router.post('/assign-tasks', async (req, res) => {
  const { lessonPlanId, assignmentDate, isAutoAssigned } = req.body;

  if (!lessonPlanId) {
    return res.status(400).json({ message: 'Request is missing lesson_plan_id.' });
  }

  try {
    
    const lessonPlan = await LessonPlan.findById(lessonPlanId);

    if (!lessonPlan?.subTasks?.length) {
      return res
        .status(404)
        .json({ message: 'Lesson plan not found or it has no sub-tasks to assign.' });
    }

    const eligibleStudents = await UserProfile.find({

      isActive: true,
      role: { $nin: ['Administrator', 'Owner', 'Manager'] },
    });

    if (!eligibleStudents || eligibleStudents.length === 0) {
      return res.status(404).json({ message: 'No eligible students found to assign tasks to.' });
    }

    let assignedCount = 0;
    let skippedCount = 0;
    const tasksToCreate = [];

    const assignerId = req.body.requestor.requestorId;

    eligibleStudents.forEach((student) => {
      const meetsPrerequisites = true;

      // keeping this block commented for future reference
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
        if (lessonPlan.subTasks && lessonPlan.subTasks.length > 0) {
          lessonPlan.subTasks.forEach((subTask) => {
            tasksToCreate.push({
              studentId: student._id,
              lessonPlanId,
              title: subTask.name,
              assignedDate: assignmentDate,
              dueDate: subTask.dueDate, 
              status: 'Assigned',
              assignedBy: assignerId,
            });
            // keeping this block commented for future reference
            // }
            // else {
            //   console.warn(`Skipping subTask for student ${student._id} due to missing name in lesson plan ${lessonPlanId}`);
            // }
          });
          assignedCount++;
        } else {
          console.warn(`Lesson plan ${lessonPlanId} has no subTasks for student ${student._id}.`);
          skippedCount++; 
        }
      } else {
        skippedCount++;
      }
    });


    if (tasksToCreate.length > 0) {
      await EducationTask.insertMany(tasksToCreate);
    }
   
    await LessonPlanLog.create({
      lessonPlanId,
      editorId: assignerId,
      action: isAutoAssigned ? 'Auto-Assigned (On Save)' : 'Manual Assignment',
      details: `Assigned to ${assignedCount} students. Skipped ${skippedCount}.`,
    });

    res.status(200).json({
      assignedCount,
      skippedCount,
    });
  } catch (error) {

    console.error('-----------------------------------------');
    console.error('Error occurred in /api/educator/assign-tasks:');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Request Body:', req.body);
    console.error('Error Details:', error); 
    console.error('-----------------------------------------');

    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred while assigning tasks.'
        : `An internal server error occurred: ${error.message}`;

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
      .populate('editorId', 'firstName lastName email')
      .sort({ logDateTime: -1 }); // Show newest first
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching lesson plan logs:', error);
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

router.post('/assign-atoms', controller.assignAtoms);

module.exports = router;
