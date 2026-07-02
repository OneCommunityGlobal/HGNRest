const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLog');

const activityLogController = function () {
  async function fetchStudentDailyLog(req, res) {
    try {
      const studentId = req.body.requestor.requestorId;

      const requestedStudentId = req.query.studentId;
      if (requestedStudentId && requestedStudentId !== String(studentId)) {
        return res.status(403).json({ error: "Forbidden: Cannot access another student's log" });
      }

      const authorizedStudentId = requestedStudentId || String(studentId);

      let objectId;
      try {
        objectId = new mongoose.Types.ObjectId(authorizedStudentId);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid studentId format' });
      }

      const logs = await ActivityLog.find({ actor_id: objectId })
        .sort({ created_at: -1 })
        .select('action_type metadata created_at actor_id');

      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async function fetchEducatorDailyLog(req, res) {
    try {
      const { studentId } = req.params;

      if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

      let objectId;
      try {
        objectId = new mongoose.Types.ObjectId(studentId);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid studentId format' });
      }

      const logs = await ActivityLog.find({ actor_id: objectId })
        .sort({ created_at: -1 })
        .select('action_type metadata created_at actor_id');

      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  return {
    fetchStudentDailyLog,
    fetchEducatorDailyLog,
  };
};

module.exports = activityLogController;
