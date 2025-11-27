const ActivityLog = require('../models/activityLog');
const UserProfile = require('../models/userProfile');

const activityLogController = function () {
  async function fetchSupportDailyLog(req, res) {
    try {
      const { studentId } = req.params;
      const { requestor } = req.body;

      if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

      if (requestor.role !== 'support') {
        return res
          .status(403)
          .json({ error: 'Forbidden: Only support role can access this endpoint' });
      }

      const studentProfile = await UserProfile.findById(studentId).select('orgId');
      if (!studentProfile) {
        return res.status(404).json({ error: 'Student not found' });
      }

      if (String(studentProfile.orgId) !== String(requestor.orgId)) {
        return res
          .status(403)
          .json({ error: 'Forbidden: Cannot access student outside your organization' });
      }

      // fetch logs
      const logs = await ActivityLog.find({ actor_id: studentId })
        .sort({ created_at: -1 })
        .select('action_type metadata created_at actor_id');

      await ActivityLog.create({
        actor_id: requestor.requestorId,
        action_type: 'view_student_daily_log',
        metadata: { viewedStudentId: studentId },
        created_at: new Date(),
      });

      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  return {
    fetchSupportDailyLog,
  };
};

module.exports = activityLogController;
