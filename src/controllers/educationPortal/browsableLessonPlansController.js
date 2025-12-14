const mongoose = require('mongoose');

const browsableLessonPlansController = function (BrowsableLessonPlan, UserProfile) {
  const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'difficulty', 'popularity']);

  function parseArrayParam(val) {
    if (!val) return undefined;
    if (Array.isArray(val)) return val;
    return String(val).split(',').map((s) => s.trim()).filter(Boolean);
  }

  const getLessonPlans = async (req, res) => {
    try {
      const {
        subject,
        subjects,
        difficulty,
        tag,
        tags,
        search,
        author,
        page = 1,
        size = 20,
        sortBy = 'createdAt',
        sortDir = 'desc',
        featured,
        dateFrom,
        dateTo,
      } = req.query;

      const filter = {};

      // Handle both singular and plural subject params
      const subjectList = parseArrayParam(subjects || subject);
      if (subjectList && subjectList.length) {
        filter.subjects = { $in: subjectList.map(s => new RegExp(s, 'i')) };
      }

      if (difficulty) {
        const diffList = parseArrayParam(difficulty);
        filter.difficulty = diffList.length > 1 ? { $in: diffList } : diffList[0];
      }

      // Handle both singular and plural tag params
      const tagList = parseArrayParam(tags || tag);
      if (tagList && tagList.length) {
        filter.tags = { $in: tagList.map(t => new RegExp(t, 'i')) };
      }

      if (author && mongoose.Types.ObjectId.isValid(author)) {
        filter.author = author;
      }

      if (featured === 'true') {
        filter.featured = true;
      }

      // Date range filtering
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }

      // Enhanced search with text index or regex fallback
      if (search) {
        const hasTextIndex = await BrowsableLessonPlan.collection.indexExists('title_text_description_text_content_text_tags_text');
        
        if (hasTextIndex) {
          filter.$text = { $search: search };
        } else {
          const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          filter.$or = [
            { title: regex },
            { description: regex },
            { content: regex },
            { tags: regex },
            { subjects: regex }
          ];
        }
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const sizeNum = Math.min(200, Math.max(1, parseInt(size, 10) || 20));
      const skip = (pageNum - 1) * sizeNum;

      const sortKey = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
      const sort = { [sortKey]: sortDir === 'asc' ? 1 : -1 };

      // Add text score sorting if using text search
      if (search && filter.$text) {
        sort.score = { $meta: 'textScore' };
      }

      const [items, total, aggregateStats] = await Promise.all([
        BrowsableLessonPlan.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(sizeNum)
          .populate('author', 'firstName lastName profilePic')
          .select('-content') // Exclude full content in list view
          .lean(),
        BrowsableLessonPlan.countDocuments(filter),
        BrowsableLessonPlan.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              subjects: { $addToSet: '$subjects' },
              difficulties: { $addToSet: '$difficulty' },
              tags: { $addToSet: '$tags' },
            },
          },
        ]),
      ]);

      // Flatten aggregated arrays
      const stats = aggregateStats[0] || {};
      const availableFilters = {
        subjects: [...new Set((stats.subjects || []).flat())].sort(),
        difficulties: (stats.difficulties || []).sort(),
        tags: [...new Set((stats.tags || []).flat())].sort(),
      };

      return res.status(200).json({
        success: true,
        data: items,
        meta: {
          page: pageNum,
          pageSize: sizeNum,
          total,
          totalPages: Math.ceil(total / sizeNum),
          filters: { subjects: subjectList, difficulty, tags: tagList, search, featured },
          availableFilters,
        },
      });
    } catch (error) {
      console.error('Error getting lesson plans:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch lesson plans', details: error.message });
    }
  };

  const getLessonPlanById = async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'Invalid lesson plan ID' });
      }

      const lessonPlan = await BrowsableLessonPlan.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
      )
        .populate('author', 'firstName lastName profilePic email')
        .lean();

      if (!lessonPlan) {
        return res.status(404).json({ success: false, error: 'Lesson plan not found' });
      }

      return res.status(200).json({ success: true, data: lessonPlan });
    } catch (error) {
      console.error('Error fetching lesson plan:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch lesson plan' });
    }
  };

  const saveStudentInterest = async (req, res) => {
    try {
      const { studentId, lessonPlanId } = req.body;
      
      if (!studentId || !lessonPlanId) {
        return res.status(400).json({ success: false, error: 'studentId and lessonPlanId are required' });
      }
      
      if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(lessonPlanId)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }

      const lesson = await BrowsableLessonPlan.findByIdAndUpdate(
        lessonPlanId,
        { $inc: { savedCount: 1 } },
        { new: true }
      ).select('_id title').lean();
      
      if (!lesson) {
        return res.status(404).json({ success: false, error: 'Lesson plan not found' });
      }

      const updated = await UserProfile.findByIdAndUpdate(
        studentId,
        { $addToSet: { savedInterests: lessonPlanId } },
        { new: true, select: 'savedInterests', runValidators: true },
      ).populate({
        path: 'savedInterests',
        select: 'title description subjects difficulty tags thumbnail createdAt savedCount views',
        populate: { path: 'author', select: 'firstName lastName' }
      });

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Student profile not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Lesson plan saved successfully',
        data: updated.savedInterests,
      });
    } catch (error) {
      console.error('Error saving student interest:', error);
      return res.status(500).json({ success: false, error: 'Failed to save interest', details: error.message });
    }
  };

  const removeStudentInterest = async (req, res) => {
    try {
      const { lessonPlanId } = req.params;
      const studentId = req.query.studentId || req.body.studentId;
      
      if (!studentId || !lessonPlanId) {
        return res.status(400).json({ success: false, error: 'studentId and lessonPlanId are required' });
      }
      
      if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(lessonPlanId)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }

      await BrowsableLessonPlan.findByIdAndUpdate(
        lessonPlanId,
        { $inc: { savedCount: -1 } }
      );

      const updated = await UserProfile.findByIdAndUpdate(
        studentId,
        { $pull: { savedInterests: lessonPlanId } },
        { new: true, select: 'savedInterests' },
      ).populate({
        path: 'savedInterests',
        select: 'title description subjects difficulty tags thumbnail createdAt savedCount views',
        populate: { path: 'author', select: 'firstName lastName' }
      });

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Student profile not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Lesson plan removed successfully',
        data: updated.savedInterests,
      });
    } catch (error) {
      console.error('Error removing saved interest:', error);
      return res.status(500).json({ success: false, error: 'Failed to remove interest', details: error.message });
    }
  };

  const getStudentSavedInterests = async (req, res) => {
    try {
      const studentId = req.query.studentId || req.headers['studentid'] || req.body.studentId;
      
      if (!studentId) {
        return res.status(400).json({ success: false, error: 'studentId is required' });
      }
      
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ success: false, error: 'Invalid studentId format' });
      }

      const user = await UserProfile.findById(studentId)
        .select('savedInterests firstName lastName')
        .populate({
          path: 'savedInterests',
          select: 'title description subjects difficulty tags thumbnail createdAt updatedAt savedCount views',
          populate: { path: 'author', select: 'firstName lastName profilePic' }
        })
        .lean();

      if (!user) {
        return res.status(404).json({ success: false, error: 'Student profile not found' });
      }

      return res.status(200).json({
        success: true,
        data: user.savedInterests || [],
        meta: {
          studentName: `${user.firstName} ${user.lastName}`,
          count: (user.savedInterests || []).length,
        },
      });
    } catch (error) {
      console.error('Error fetching saved interests:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch saved interests', details: error.message });
    }
  };

  const checkIfSaved = async (req, res) => {
    try {
      const { studentId, lessonPlanId } = req.query;
      
      if (!studentId || !lessonPlanId) {
        return res.status(400).json({ success: false, error: 'studentId and lessonPlanId are required' });
      }

      const user = await UserProfile.findById(studentId).select('savedInterests').lean();
      
      if (!user) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }

      const isSaved = user.savedInterests?.some(id => id.toString() === lessonPlanId);

      return res.status(200).json({ success: true, isSaved });
    } catch (error) {
      console.error('Error checking saved status:', error);
      return res.status(500).json({ success: false, error: 'Failed to check saved status' });
    }
  };

  return {
    getLessonPlans,
    getLessonPlanById,
    saveStudentInterest,
    getStudentSavedInterests,
    removeStudentInterest,
    checkIfSaved,
  };
};

module.exports = browsableLessonPlansController;