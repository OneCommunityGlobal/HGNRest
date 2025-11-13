const TaskComment = require('../models/taskComment');
const StudentTask = require('../models/studentTask');
const User = require('../models/userTask');

exports.postStudentComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { commentText } = req.body;
    const { userId } = req.query;

    if (!userId) return res.status(403).json({ message: 'userId required' });
    if (!commentText || commentText.trim() === '')
      return res.status(400).json({ message: 'commentText cannot be empty' });

    const user = await User.findById(userId);
    if (!user) return res.status(403).json({ message: 'Invalid userId' });
    if (user.role !== 'student')
      return res.status(403).json({ message: 'Only students can post comments' });

    const task = await StudentTask.findOne({ taskId });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const comment = await TaskComment.create({
      taskId,
      userId: user._id,
      commentText,
    });

    const cleanedComment = {
      commentId: comment._id.toString(),
      taskId: comment.taskId,
      userId: comment.userId?.toString(),
      commentText: comment.commentText,
      created_at: comment.created_at,
      isDeleted: false,
    };

    res.status(201).json(cleanedComment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStudentCommentsbyStudent = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.query;
    console.log('Fetching comments for task:', taskId, 'by user:', userId);
    const user = await User.findById(userId);
    if (!user) return res.status(403).json({ message: 'Invalid userId' });
    if (user.role !== 'student')
      return res.status(403).json({ message: 'Only students can view this data' });

    const task = await StudentTask.findOne({ taskId });
    if (!task) return res.status(404).json({ message: 'Task does not exist' });

    const comments = await TaskComment.find(
      {
        taskId,
        userId: user._id,
        isDeleted: false,
      },
      { isDeleted: 0, __v: 0 },
    )
      .sort({ created_at: 1 })
      .lean();

    const cleanedComments = comments.map((c) => ({
      commentId: c._id.toString(),
      taskId: c.taskId,
      userId: c.userId?.toString(),
      commentText: c.commentText,
      created_at: c.created_at,
    }));

    res.json(cleanedComments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStudentCommentsbyEducator = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.query;

    const user = await User.findById(userId);
    if (!user) return res.status(403).json({ message: 'Invalid userId' });
    if (user.role !== 'educator')
      return res.status(403).json({ message: 'Only educators can view this data' });

    const task = await StudentTask.findOne({ taskId });
    if (!task) return res.status(404).json({ message: 'Task does not exist' });

    const comments = await TaskComment.find(
      {
        taskId,
        isDeleted: false,
      },
      { isDeleted: 0, __v: 0 },
    )
      .sort({ created_at: 1 })
      .lean();

    const cleanedComments = comments.map((c) => ({
      commentId: c._id.toString(),
      taskId: c.taskId,
      userId: c.userId?.toString(),
      commentText: c.commentText,
      created_at: c.created_at,
    }));

    res.json(cleanedComments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
