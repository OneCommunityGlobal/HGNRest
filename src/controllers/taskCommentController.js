const TaskComment = require('../models/taskComment');
const StudentTask = require('../models/studentTask');

// Matches the case-variant convention used in educatorController.js's validRoles.
const studentRoles = ['student', 'Student'];
const educatorRoles = ['admin', 'educator', 'Educator', 'teacher', 'Teacher', 'owner', 'Owner', 'Administrator'];

const hasRole = (requestor, allowedRoles) =>
  !!requestor && !!requestor.requestorId && allowedRoles.includes(requestor.role);

const findTaskByTaskId = async (taskId) => {
  const task = await StudentTask.findOne({ taskId });
  if (!task) {
    return { error: { status: 404, message: 'Task does not exist' } };
  }
  return { task };
};

const formatComment = (comment) => ({
  commentId: comment._id.toString(),
  taskId: comment.taskId,
  userId: comment.userId?.toString(),
  commentText: comment.commentText,
  created_at: comment.created_at,
});

const getComments = async (filter) => {
  const comments = await TaskComment.find(filter, { isDeleted: 0, __v: 0 })
    .sort({ created_at: 1 })
    .lean();
  return comments.map(formatComment);
};

const handleServerError = (res, err) => {
  console.error(err);
  return res.status(500).json({ message: 'Server error' });
};

/**
 * POST /student/tasks/:taskId/comments
 * Student adds a comment on a task.
 */
exports.postStudentComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { commentText } = req.body;
    const { requestor } = req.body;

    if (!requestor?.requestorId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasRole(requestor, studentRoles)) {
      return res.status(403).json({ message: 'Only students can access this data' });
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
      userId: requestor.requestorId,
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

/**
 * GET /student/tasks/:taskId/comments  (allowedRoles = studentRoles, scoped to own comments)
 * GET /educator/tasks/:taskId/comments (allowedRoles = educatorRoles, all comments on the task)
 */
const getStudentComments = (allowedRoles, scopeToOwnUser) => async (req, res) => {
  try {
    const { taskId } = req.params;
    const { requestor } = req.body;

    if (!requestor?.requestorId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasRole(requestor, allowedRoles)) {
      return res.status(403).json({
        message:
          allowedRoles === studentRoles
            ? 'Only students can access this data'
            : 'Only educators can access this data',
      });
    }

    const taskResult = await findTaskByTaskId(taskId);
    if (taskResult.error) {
      return res.status(taskResult.error.status).json({ message: taskResult.error.message });
    }

    const filter = {
      taskId,
      isDeleted: false,
      ...(scopeToOwnUser && { userId: requestor.requestorId }),
    };

    const comments = await getComments(filter);
    return res.json(comments);
  } catch (err) {
    return handleServerError(res, err);
  }
};

exports.getStudentCommentsbyStudent = getStudentComments(studentRoles, true);
exports.getStudentCommentsbyEducator = getStudentComments(educatorRoles, false);

/**
 * DELETE /student/tasks/:taskId/comments/:commentId
 * Student soft-deletes their own comment. (New — spec's isDeleted flag existed
 * in the model but had no endpoint to trigger it.)
 */
exports.deleteStudentComment = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const { requestor } = req.body;

    if (!requestor?.requestorId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasRole(requestor, studentRoles)) {
      return res.status(403).json({ message: 'Only students can access this data' });
    }

    const comment = await TaskComment.findOne({ _id: commentId, taskId });
    if (!comment) {
      return res.status(404).json({ message: 'Comment does not exist' });
    }

    if (comment.userId.toString() !== requestor.requestorId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    comment.isDeleted = true;
    await comment.save();

    return res.status(200).json({ message: 'Comment deleted' });
  } catch (err) {
    return handleServerError(res, err);
  }
};
