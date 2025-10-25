const mongoose = require('mongoose');

const browsableLessonPlansController = function (BrowsableLessonPlan, UserProfile) {
  // GET /lesson-plans
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
      if (subject) filter.subjects = subject;
      if (difficulty) filter.difficulty = difficulty;
      if (tag) filter.tags = tag;
      if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [{ title: regex }, { description: regex }, { content: regex }, { tags: regex }];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const sizeNum = Math.max(1, parseInt(size, 10));
      const skip = (pageNum - 1) * sizeNum;
      const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

      const [items, total] = await Promise.all([
        BrowsableLessonPlan.find(filter).sort(sort).skip(skip).limit(sizeNum).lean(),
        BrowsableLessonPlan.countDocuments(filter),
      ]);

      res.status(200).json({
        items,
        pagination: {
          total,
          page: pageNum,
          pageSize: sizeNum,
          totalPages: Math.ceil(total / sizeNum),
        },
      });
    } catch (error) {
      console.error('Error getting lesson plans:', error);
      res.status(500).json({ error: error.message });
    }
  };

  // POST /student/saved-interests
  const saveStudentInterest = async (req, res) => {
    try {
      const { studentId, lessonPlanId } = req.body;
      if (!studentId || !lessonPlanId) {
        return res.status(400).json({ message: 'studentId and lessonPlanId are required' });
      }
      if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(lessonPlanId)) {
        return res.status(400).json({ message: 'Invalid id provided' });
      }

      const lesson = await BrowsableLessonPlan.findById(lessonPlanId).lean();
      if (!lesson) return res.status(404).json({ message: 'Lesson plan not found' });

      const user = await UserProfile.findById(studentId);
      if (!user) return res.status(404).json({ message: 'Student not found' });

      user.savedInterests = user.savedInterests || [];
      if (!user.savedInterests.includes(lessonPlanId)) {
        user.savedInterests.push(lessonPlanId);
        await user.save();
      }

      res.status(200).json({ message: 'Saved', savedInterests: user.savedInterests });
    } catch (error) {
      console.error('Error saving student interest:', error);
      res.status(500).json({ error: error.message });
    }
  };

  // GET /student/saved-interests
  const getStudentSavedInterests = async (req, res) => {
    try {
      const studentId = req.query.studentId || req.headers['studentid'] || req.body.studentId;
      if (!studentId) return res.status(400).json({ message: 'studentId is required' });
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: 'Invalid studentId' });
      }

      const user = await UserProfile.findById(studentId).populate({
        path: 'savedInterests',
        model: BrowsableLessonPlan,
      });

      if (!user) return res.status(404).json({ message: 'Student not found' });

      res.status(200).json({ savedInterests: user.savedInterests || [] });
    } catch (error) {
      console.error('Error fetching saved interests:', error);
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getLessonPlans,
    saveStudentInterest,
    getStudentSavedInterests,
  };
};

module.exports = browsableLessonPlansController;