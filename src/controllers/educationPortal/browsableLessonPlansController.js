const mongoose = require('mongoose');

const browsableLessonPlansController = function (BrowsableLessonPlan, UserProfile) {
  const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'difficulty']);

  function parseArrayParam(val) {
    if (!val) return undefined;
    if (Array.isArray(val)) return val;
    return String(val).split(',').map((s) => s.trim()).filter(Boolean);
  }

  const getLessonPlans = async (req, res) => {
    try {
      const {
        subject,
        difficulty,
        tag,
        search,
        page = 1,
        size = 20,
        sortBy = 'createdAt',
        sortDir = 'desc',
      } = req.query;

      const filter = {};

      const subjects = parseArrayParam(subject);
      if (subjects && subjects.length) filter.subjects = { $in: subjects };

      if (difficulty) filter.difficulty = difficulty;

      const tags = parseArrayParam(tag);
      if (tags && tags.length) filter.tags = { $in: tags };

      if (search) {
        if (BrowsableLessonPlan.collection.indexExists) {
          filter.$text = { $search: search };
        } else {
          const regex = new RegExp(search, 'i');
          filter.$or = [{ title: regex }, { description: regex }, { content: regex }, { tags: regex }];
        }
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const sizeNum = Math.min(200, Math.max(1, parseInt(size, 10) || 20));
      const skip = (pageNum - 1) * sizeNum;

      const sortKey = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
      const sort = { [sortKey]: sortDir === 'asc' ? 1 : -1 };

      const [items, total] = await Promise.all([
        BrowsableLessonPlan.find(filter).sort(sort).skip(skip).limit(sizeNum).lean(),
        BrowsableLessonPlan.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: items,
        meta: {
          page: pageNum,
          pageSize: sizeNum,
          total,
          totalPages: Math.ceil(total / sizeNum),
          filters: { subjects, difficulty, tags, search },
        },
      });
    } catch (error) {
      console.error('Error getting lesson plans:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch lesson plans' });
    }
  };

  const saveStudentInterest = async (req, res) => {
    try {
      const { studentId, lessonPlanId } = req.body;
      if (!studentId || !lessonPlanId) {
        return res.status(400).json({ success: false, error: 'studentId and lessonPlanId are required' });
      }
      if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(lessonPlanId)) {
        return res.status(400).json({ success: false, error: 'Invalid id provided' });
      }

      const lesson = await BrowsableLessonPlan.findById(lessonPlanId).select('_id').lean();
      if (!lesson) return res.status(404).json({ success: false, error: 'Lesson plan not found' });

      const updated = await UserProfile.findByIdAndUpdate(
        studentId,
        { $addToSet: { savedInterests: lessonPlanId } },
        { new: true, select: 'savedInterests', runValidators: true },
      ).populate({ path: 'savedInterests', select: 'title subjects difficulty tags createdAt' });

      if (!updated) return res.status(404).json({ success: false, error: 'Student not found' });

      return res.status(200).json({ success: true, data: updated.savedInterests });
    } catch (error) {
      console.error('Error saving student interest:', error);
      return res.status(500).json({ success: false, error: 'Failed to save interest' });
    }
  };

  const removeStudentInterest = async (req, res) => {
    try {
      const lessonPlanId = req.params.lessonPlanId;
      const studentId = req.query.studentId || req.body.studentId;
      if (!studentId || !lessonPlanId) {
        return res.status(400).json({ success: false, error: 'studentId and lessonPlanId are required' });
      }
      if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(lessonPlanId)) {
        return res.status(400).json({ success: false, error: 'Invalid id provided' });
      }

      const updated = await UserProfile.findByIdAndUpdate(
        studentId,
        { $pull: { savedInterests: lessonPlanId } },
        { new: true, select: 'savedInterests' },
      ).populate({ path: 'savedInterests', select: 'title subjects difficulty tags createdAt' });

      if (!updated) return res.status(404).json({ success: false, error: 'Student not found' });

      return res.status(200).json({ success: true, data: updated.savedInterests });
    } catch (error) {
      console.error('Error removing saved interest:', error);
      return res.status(500).json({ success: false, error: 'Failed to remove interest' });
    }
  };

  const getStudentSavedInterests = async (req, res) => {
    try {
      const studentId = req.query.studentId || req.headers['studentid'] || req.body.studentId;
      if (!studentId) return res.status(400).json({ success: false, error: 'studentId is required' });
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ success: false, error: 'Invalid studentId' });
      }

      const full = req.query.full === 'true' || req.query.full === true;

      const projection = full ? null : 'savedInterests';
      const populateOpts = {
        path: 'savedInterests',
        select: 'title description subjects difficulty tags createdAt updatedAt',
      };

      const user = await UserProfile.findById(studentId).select(projection).populate(populateOpts);

      if (!user) return res.status(404).json({ success: false, error: 'Student not found' });

      const saved = full ? user.savedInterests : user.savedInterests || [];

      return res.status(200).json({ success: true, data: saved });
    } catch (error) {
      console.error('Error fetching saved interests:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch saved interests' });
    }
  };

  return {
    getLessonPlans,
    saveStudentInterest,
    getStudentSavedInterests,
    removeStudentInterest,
  };
};

module.exports = browsableLessonPlansController;