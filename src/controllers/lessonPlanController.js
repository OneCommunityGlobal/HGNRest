const mongoose = require('mongoose');
const LessonPlan = require('../models/lessonPlan');
const Activity = require('../models/activity');
const UserProfile = require('../models/userProfile');

const lessonPlanController = function () {
  // Get all lesson plans
  const getLessonPlans = async (req, res) => {
    try {
      const lessonPlans = await LessonPlan.find({})
        .populate('createdBy', 'firstName lastName email')
        .populate('activities', 'title description')
        .sort({ createdAt: -1 });
      res.status(200).json(lessonPlans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get lesson plans by creator
  const getLessonPlansByCreator = async (req, res) => {
    try {
      const { creatorId } = req.params;
      const lessonPlans = await LessonPlan.find({ createdBy: creatorId })
        .populate('createdBy', 'firstName lastName email')
        .populate('activities', 'title description')
        .sort({ createdAt: -1 });
      res.status(200).json(lessonPlans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get lesson plan by ID
  const getLessonPlanById = async (req, res) => {
    try {
      const { id } = req.params;
      const lessonPlan = await LessonPlan.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate({
          path: 'activities',
          populate: {
            path: 'atomTaskTemplates.atomId',
            select: 'name description difficulty'
          }
        });
      
      if (!lessonPlan) {
        return res.status(404).json({ error: 'Lesson plan not found' });
      }
      
      res.status(200).json(lessonPlan);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new lesson plan
  const createLessonPlan = async (req, res) => {
    try {
      const { 
        title, 
        theme, 
        description, 
        startDate, 
        endDate, 
        createdBy 
      } = req.body;

      // Validate creator exists
      const creator = await UserProfile.findById(createdBy);
      if (!creator) {
        return res.status(404).json({ error: 'Creator not found' });
      }

      // Validate dates
      if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }

      const lessonPlan = new LessonPlan({
        title,
        theme,
        description,
        startDate,
        endDate,
        createdBy,
        activities: []
      });

      const savedLessonPlan = await lessonPlan.save();
      const populatedLessonPlan = await LessonPlan.findById(savedLessonPlan._id)
        .populate('createdBy', 'firstName lastName email');

      res.status(201).json(populatedLessonPlan);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update lesson plan
  const updateLessonPlan = async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        title, 
        theme, 
        description, 
        startDate, 
        endDate 
      } = req.body;

      const lessonPlan = await LessonPlan.findById(id);
      if (!lessonPlan) {
        return res.status(404).json({ error: 'Lesson plan not found' });
      }

      // Validate dates if both are provided
      if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }

      const updatedLessonPlan = await LessonPlan.findByIdAndUpdate(
        id,
        { title, theme, description, startDate, endDate },
        { new: true, runValidators: true }
      ).populate('createdBy', 'firstName lastName email')
       .populate('activities', 'title description');

      res.status(200).json(updatedLessonPlan);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete lesson plan
  const deleteLessonPlan = async (req, res) => {
    try {
      const { id } = req.params;

      const lessonPlan = await LessonPlan.findById(id);
      if (!lessonPlan) {
        return res.status(404).json({ error: 'Lesson plan not found' });
      }

      // Delete associated activities
      await Activity.deleteMany({ lessonPlanId: id });

      await LessonPlan.findByIdAndDelete(id);
      res.status(200).json({ message: 'Lesson plan deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get lesson plans by date range
  const getLessonPlansByDateRange = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const query = {};
      if (startDate && endDate) {
        query.startDate = { $gte: new Date(startDate) };
        query.endDate = { $lte: new Date(endDate) };
      } else if (startDate) {
        query.startDate = { $gte: new Date(startDate) };
      } else if (endDate) {
        query.endDate = { $lte: new Date(endDate) };
      }

      const lessonPlans = await LessonPlan.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('activities', 'title description')
        .sort({ startDate: 1 });

      res.status(200).json(lessonPlans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get lesson plans by theme
  const getLessonPlansByTheme = async (req, res) => {
    try {
      const { theme } = req.params;
      const lessonPlans = await LessonPlan.find({ theme })
        .populate('createdBy', 'firstName lastName email')
        .populate('activities', 'title description')
        .sort({ createdAt: -1 });
      res.status(200).json(lessonPlans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getLessonPlans,
    getLessonPlansByCreator,
    getLessonPlanById,
    createLessonPlan,
    updateLessonPlan,
    deleteLessonPlan,
    getLessonPlansByDateRange,
    getLessonPlansByTheme
  };
};

module.exports = lessonPlanController; 