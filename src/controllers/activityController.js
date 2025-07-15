const mongoose = require('mongoose');
const Activity = require('../models/activity');
const LessonPlan = require('../models/lessonPlan');
const Subject = require('../models/subject');
const Atom = require('../models/atom');

const activityController = function () {
  // Get all activities
  const getActivities = async (req, res) => {
    try {
      const activities = await Activity.find({})
        .populate('lessonPlanId', 'title theme')
        .populate('atomTaskTemplates.subjectId', 'name iconUrl')
        .populate('atomTaskTemplates.atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(activities);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get activities by lesson plan
  const getActivitiesByLessonPlan = async (req, res) => {
    try {
      const { lessonPlanId } = req.params;
      const activities = await Activity.find({ lessonPlanId })
        .populate('lessonPlanId', 'title theme')
        .populate('atomTaskTemplates.subjectId', 'name iconUrl')
        .populate('atomTaskTemplates.atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(activities);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get activity by ID
  const getActivityById = async (req, res) => {
    try {
      const { id } = req.params;
      const activity = await Activity.findById(id)
        .populate('lessonPlanId', 'title theme')
        .populate('atomTaskTemplates.subjectId', 'name iconUrl')
        .populate('atomTaskTemplates.atomId', 'name description difficulty');
      
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      
      res.status(200).json(activity);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new activity
  const createActivity = async (req, res) => {
    try {
      const { 
        lessonPlanId, 
        title, 
        description, 
        atomTaskTemplates 
      } = req.body;

      // Validate lesson plan exists
      const lessonPlan = await LessonPlan.findById(lessonPlanId);
      if (!lessonPlan) {
        return res.status(404).json({ error: 'Lesson plan not found' });
      }

      // Validate atom task templates
      if (atomTaskTemplates && atomTaskTemplates.length > 0) {
        for (const template of atomTaskTemplates) {
          // Validate subject exists
          const subject = await Subject.findById(template.subjectId);
          if (!subject) {
            return res.status(404).json({ error: `Subject ${template.subjectId} not found` });
          }

          // Validate atom exists
          const atom = await Atom.findById(template.atomId);
          if (!atom) {
            return res.status(404).json({ error: `Atom ${template.atomId} not found` });
          }

          // Validate task type
          const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
          if (!validTaskTypes.includes(template.taskType)) {
            return res.status(400).json({ 
              error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` 
            });
          }
        }
      }

      const activity = new Activity({
        lessonPlanId,
        title,
        description,
        atomTaskTemplates: atomTaskTemplates || []
      });

      const savedActivity = await activity.save();

      // Add activity to lesson plan's activities array
      lessonPlan.activities.push(savedActivity._id);
      await lessonPlan.save();

      const populatedActivity = await Activity.findById(savedActivity._id)
        .populate('lessonPlanId', 'title theme')
        .populate('atomTaskTemplates.subjectId', 'name iconUrl')
        .populate('atomTaskTemplates.atomId', 'name description difficulty');

      res.status(201).json(populatedActivity);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update activity
  const updateActivity = async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        title, 
        description, 
        atomTaskTemplates 
      } = req.body;

      const activity = await Activity.findById(id);
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      // Validate atom task templates if provided
      if (atomTaskTemplates && atomTaskTemplates.length > 0) {
        for (const template of atomTaskTemplates) {
          // Validate subject exists
          const subject = await Subject.findById(template.subjectId);
          if (!subject) {
            return res.status(404).json({ error: `Subject ${template.subjectId} not found` });
          }

          // Validate atom exists
          const atom = await Atom.findById(template.atomId);
          if (!atom) {
            return res.status(404).json({ error: `Atom ${template.atomId} not found` });
          }

          // Validate task type
          const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
          if (!validTaskTypes.includes(template.taskType)) {
            return res.status(400).json({ 
              error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` 
            });
          }
        }
      }

      const updatedActivity = await Activity.findByIdAndUpdate(
        id,
        { title, description, atomTaskTemplates },
        { new: true, runValidators: true }
      ).populate('lessonPlanId', 'title theme')
       .populate('atomTaskTemplates.subjectId', 'name iconUrl')
       .populate('atomTaskTemplates.atomId', 'name description difficulty');

      res.status(200).json(updatedActivity);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete activity
  const deleteActivity = async (req, res) => {
    try {
      const { id } = req.params;

      const activity = await Activity.findById(id);
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      // Remove activity from lesson plan's activities array
      const lessonPlan = await LessonPlan.findById(activity.lessonPlanId);
      if (lessonPlan) {
        lessonPlan.activities = lessonPlan.activities.filter(
          activityId => !activityId.equals(id)
        );
        await lessonPlan.save();
      }

      await Activity.findByIdAndDelete(id);
      res.status(200).json({ message: 'Activity deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Add atom task template to activity
  const addAtomTaskTemplate = async (req, res) => {
    try {
      const { activityId } = req.params;
      const { subjectId, atomId, taskType, instructions, resources } = req.body;

      const activity = await Activity.findById(activityId);
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      // Validate subject exists
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Validate atom exists
      const atom = await Atom.findById(atomId);
      if (!atom) {
        return res.status(404).json({ error: 'Atom not found' });
      }

      // Validate task type
      const validTaskTypes = ['read', 'write', 'practice', 'quiz', 'project'];
      if (!validTaskTypes.includes(taskType)) {
        return res.status(400).json({ 
          error: `Invalid task type. Must be one of: ${validTaskTypes.join(', ')}` 
        });
      }

      const newTemplate = {
        subjectId,
        atomId,
        taskType,
        instructions,
        resources: resources || []
      };

      activity.atomTaskTemplates.push(newTemplate);
      await activity.save();

      const updatedActivity = await Activity.findById(activityId)
        .populate('lessonPlanId', 'title theme')
        .populate('atomTaskTemplates.subjectId', 'name iconUrl')
        .populate('atomTaskTemplates.atomId', 'name description difficulty');

      res.status(200).json(updatedActivity);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Remove atom task template from activity
  const removeAtomTaskTemplate = async (req, res) => {
    try {
      const { activityId, templateIndex } = req.params;

      const activity = await Activity.findById(activityId);
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      const index = parseInt(templateIndex);
      if (index < 0 || index >= activity.atomTaskTemplates.length) {
        return res.status(404).json({ error: 'Template index not found' });
      }

      activity.atomTaskTemplates.splice(index, 1);
      await activity.save();

      const updatedActivity = await Activity.findById(activityId)
        .populate('lessonPlanId', 'title theme')
        .populate('atomTaskTemplates.subjectId', 'name iconUrl')
        .populate('atomTaskTemplates.atomId', 'name description difficulty');

      res.status(200).json(updatedActivity);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getActivities,
    getActivitiesByLessonPlan,
    getActivityById,
    createActivity,
    updateActivity,
    deleteActivity,
    addAtomTaskTemplate,
    removeAtomTaskTemplate
  };
};

module.exports = activityController; 