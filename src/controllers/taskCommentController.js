const TaskComment = require('../models/taskComment');
const StudentTask = require('../models/studentTask');
const User = require('../models/user'); // verify this path

const findAndValidateUser = async (userId, allowedRole) => {
  if (!userId) {
    return { error: { status: 403, message: 'userId required' } };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { error: { status: 403, message: 'Invalid userId' } };
  }

  if (user.role !== allowedRole) {
    return {
      error: {
        status: 403,
        message:
          allowedRole === 'student'
            ? 'Only students can access this data'
            : 'Only educators can access this data',
      },
    };
  }

  return { user };
};

const findTaskByTaskId = async taskId => {
  const task = await StudentTask.findOne({ taskId });
  if (!task) {
    return { error: { status: 404, message: 'Task does not exist' } };
  }

  return { task };
};

const formatComment = comment => ({
  commentId: comment._id.toString(),
  taskId: comment.taskId,
  userId: comment.userId?.toString(),
  commentText: comment.commentText,
  created_at: comment.created_at,
});

const getComments = async filter => {
  const comments = await TaskComment.find(filter, { isDeleted: 0, __v: 0 })
    .sort({ created_at: 1 })
    .lean();

  return comments.map(formatComment);
};

const handleServerError = (res, err) => {
  console.error(err);
  return res.status(500).json({ message: 'Server error' });
};

exports.postStudentComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { commentText } = req.body;
    const { userId } = req.query;

    const userResult = await findAndValidateUser(userId, 'student');
    if (userResult.error) {
      return res.status(userResult.error.status).json({ message: userResult.error.message });
    }

    if (!commentText || commentText.trim() === '') {
      return res.status(400).json({ message: 'commentText cannot be empty' });
    }

    const taskResult = await findTaskByTaskId(taskId);
    if (taskResult.error) {
      return res.status(taskResult.error.status).json({ message: taskResult.error.message });
    }

    const comment = await TaskComment.create({
      taskId,
      userId: userResult.user._id,
      commentText,
    });

    return res.status(201).json({
      ...formatComment(comment),
      isDeleted: false,
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

const getStudentComments = allowedRole => async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.query;

    const userResult = await findAndValidateUser(userId, allowedRole);
    if (userResult.error) {
      return res.status(userResult.error.status).json({ message: userResult.error.message });
    }

    const taskResult = await findTaskByTaskId(taskId);
    if (taskResult.error) {
      return res.status(taskResult.error.status).json({ message: taskResult.error.message });
    }

    const filter = {
      taskId,
      isDeleted: false,
      ...(allowedRole === 'student' && { userId: userResult.user._id }),
    };

    const comments = await getComments(filter);
    return res.json(comments);
  } catch (err) {
    return handleServerError(res, err);
  }
};

exports.getStudentCommentsbyStudent = getStudentComments('student');
exports.getStudentCommentsbyEducator = getStudentComments('educator');
