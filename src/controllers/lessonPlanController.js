const mongoose = require('mongoose');
const LessonPlan = require('../models/lessonPlan');
const Activity = require('../models/activity');

const editableFields = ['title', 'theme', 'description', 'startDate', 'endDate', 'subTasks'];
const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

// Authentication middleware overwrites requestor using the verified JWT, not client identity.
const authorizeEditor = (req, res) => {
  const requestor = req.body.requestor || {};
  if (!isObjectId(requestor.requestorId)) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (!['Educator', 'Administrator', 'Owner'].includes(requestor.role)) {
    res.status(403).json({ error: 'Educator or administrator access required' });
    return null;
  }
  return requestor;
};

// API dates use calendar-date strings; existing documents contain Mongoose Date values.
const validDate = (value) => {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().startsWith(value)
  );
};

// Match the builder's existing percentage and fraction formats, including decimal values.
const validWeight = (value) => {
  if (typeof value !== 'string') return false;
  const weight = value.trim();
  return /^(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(weight) && Number(weight.replace('%', '')) <= 100;
};
const validPassMark = (value) => {
  if (typeof value !== 'string') return false;
  const fraction = value.trim().split('/');
  if (fraction.length !== 2) return false;
  const numberPattern = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
  const numerator = numberPattern.exec(fraction[0].trim());
  const denominator = numberPattern.exec(fraction[1].trim());
  if (!numerator || !denominator) return false;
  const [numeratorValue, denominatorValue] = [numerator[0], denominator[0]].map(Number);
  return (
    [numeratorValue, denominatorValue].every(Number.isFinite) &&
    denominatorValue > 0 &&
    numeratorValue <= denominatorValue
  );
};
const validateSubTask = (task) => {
  if (!task || typeof task !== 'object' || Array.isArray(task)) return 'Subtask must be an object';
  if (typeof task.name !== 'string' || !task.name.trim()) return 'Subtask name is required';
  if (!['Write-only', 'Read-only', 'Offline entry'].includes(task.type))
    return 'Invalid subtask type';
  if (!validDate(task.dueDate)) return 'Subtask dueDate must be a valid YYYY-MM-DD date';
  if (!validWeight(task.weight))
    return 'Subtask weight must be between 0 and 100, optionally followed by %';
  if (!validPassMark(task.passMark))
    return 'Subtask passMark must be a fraction with 0 <= numerator <= positive denominator';
  if (task._id !== undefined && !isObjectId(String(task._id))) return 'Invalid subtask ID';
  return null;
};

const validatePlan = (plan) => {
  if (typeof plan.title !== 'string' || !plan.title.trim()) return 'Title is required';
  if (
    ['theme', 'description'].some(
      (field) => plan[field] !== undefined && typeof plan[field] !== 'string',
    )
  ) {
    return 'Theme and description must be strings';
  }
  if (!validDate(plan.startDate) || !validDate(plan.endDate))
    return 'Start and end dates must be valid YYYY-MM-DD dates';
  if (new Date(plan.startDate) > new Date(plan.endDate))
    return 'End date must be on or after start date';
  if (!Array.isArray(plan.subTasks) || !plan.subTasks.length)
    return 'At least one subtask is required';
  const subTaskError = plan.subTasks.map(validateSubTask).find(Boolean);
  if (subTaskError) return subTaskError;
  // Compare persisted ObjectIds and hexadecimal strings alike; ID-less new rows
  // remain independent and receive their identities from Mongoose on persistence.
  const ids = plan.subTasks
    .filter((task) => task._id !== undefined)
    .map((task) => String(task._id).toLowerCase());
  if (new Set(ids).size !== ids.length) return 'Subtask IDs must be unique within a lesson plan';
  return null;
};

// Only editable fields reach the model; creator, editor, activities and operators are excluded.
const editableValues = (body) =>
  Object.fromEntries(
    editableFields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]]),
  );
const cleanSubTasks = (tasks) =>
  tasks.map((task) =>
    Object.fromEntries(
      ['_id', 'name', 'type', 'dueDate', 'passMark', 'weight']
        .filter((field) => task[field] !== undefined)
        .map((field) => [field, task[field]]),
    ),
  );
const saveError = (res, error) =>
  res.status(['ValidationError', 'CastError'].includes(error.name) ? 400 : 500).json({
    error:
      error.name === 'ValidationError' || error.name === 'CastError'
        ? 'Invalid lesson plan data'
        : 'Unable to save lesson plan',
  });

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
            select: 'name description difficulty',
          },
        });

      if (!lessonPlan) {
        return res.status(404).json({ error: 'Lesson plan not found' });
      }

      res.status(200).json(lessonPlan);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Saving deliberately does not assign tasks. The caller assigns only after this succeeds.
  const createLessonPlan = async (req, res) => {
    const requestor = authorizeEditor(req, res);
    if (!requestor) return;
    try {
      const values = editableValues(req.body);
      const error = validatePlan(values);
      if (error) return res.status(400).json({ error });
      const lessonPlan = new LessonPlan({
        ...values,
        subTasks: cleanSubTasks(values.subTasks),
        createdBy: requestor.requestorId,
        lastEditedBy: requestor.requestorId,
        activities: [],
      });
      res.status(201).json(await lessonPlan.save());
    } catch (error) {
      saveError(res, error);
    }
  };

  const updateLessonPlan = async (req, res) => {
    const requestor = authorizeEditor(req, res);
    if (!requestor) return;
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ error: 'Invalid lesson plan ID' });
    try {
      const lessonPlan = await LessonPlan.findById(id);
      if (!lessonPlan) return res.status(404).json({ error: 'Lesson plan not found' });
      const isEducator = requestor.role === 'Educator';
      if (isEducator && String(lessonPlan.createdBy) !== requestor.requestorId) {
        return res.status(403).json({ error: 'You may only update your own lesson plans' });
      }
      const values = editableValues(req.body);
      if (!Object.keys(values).length)
        return res.status(400).json({ error: 'No editable fields provided' });
      // Validate the merged plan so a partial date update cannot bypass date ordering.
      const error = validatePlan({ ...lessonPlan.toObject(), ...values });
      if (error) return res.status(400).json({ error });
      if (values.subTasks) values.subTasks = cleanSubTasks(values.subTasks);
      // Repeat ownership in the write filter to avoid a read/write authorization race.
      // Compare and increment Mongoose's version key atomically so validation
      // cannot be applied to a document changed since the read (including legacy plans).
      const filter = {
        _id: new mongoose.Types.ObjectId(id),
        __v: lessonPlan.__v === undefined ? { $exists: false } : lessonPlan.__v,
        ...(isEducator ? { createdBy: new mongoose.Types.ObjectId(requestor.requestorId) } : {}),
      };
      const savedPlan = await LessonPlan.findOneAndUpdate(
        filter,
        { $set: { ...values, lastEditedBy: requestor.requestorId }, $inc: { __v: 1 } },
        { new: true, runValidators: true },
      );
      if (!savedPlan)
        return res
          .status(409)
          .json({ error: 'Lesson plan changed during this update. Reload it and try again.' });
      res.status(200).json(savedPlan);
    } catch (error) {
      saveError(res, error);
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
    getLessonPlansByTheme,
  };
};

module.exports = lessonPlanController;
