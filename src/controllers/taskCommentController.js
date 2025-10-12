const TaskComment = require('../models/taskComment');

const taskCommentController = function () {
  const postStudentComments = async (req, res) => {
    try {
      const { studentId } = req.params;
      const { comment, taskId } = req.body;
      const newComment = await TaskComment.create({
        taskId,
        studentId,
        comment,
      });
      res.status(201).json(newComment);
    } catch (error) {
      res.status(500).json({ error: 'Failed to post comment.' });
    }
  };

  // GET /educator/tasks/:taskId/comments
  const getStudentCommentsbyEducator = async (req, res) => {
    try {
      const { taskId } = req.params;
      const comments = await TaskComment.find({ taskId });
      res.status(200).json(comments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch comments.' });
    }
  };

  // GET /student/tasks/:taskId/comments
  const getStudentCommentsbyStudent = async (req, res) => {
    try {
      const { taskId } = req.params;
      const { studentId } = req.query;
      const comments = await TaskComment.find({ taskId, studentId });
      res.status(200).json(comments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch comments.' });
    }
  };

  return { postStudentComments, getStudentCommentsbyEducator, getStudentCommentsbyStudent };
};

module.exports = taskCommentController;
