const ActivityLog = require('../models/activityLog');
const StudentLog = require('../models/studentLog');
const { hasPermission } = require('../utilities/permissions');

const activityLogController = function () {
  async function fetchSupportDailyLog(req, res) {
    try {
      const { studentId } = req.params;
      const { requestor } = req.body;

      if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

      if (!(await hasPermission(requestor, 'fetchSupportDailyLog'))) {
        return res
          .status(403)
          .json({ error: 'Forbidden: Only support role can access this endpoint' });
      }

      // Fetch logs for the specified student asssuming this 
      // student is a assigned to the support staff. 
      // Need to add a check for that in the future.
      const logs = await StudentLog.find({studentId}).sort({date:-1}) ;

      
      // Log the activity of viewing the student's daily log
      await ActivityLog.create({
        actor_id: requestor.requestorId,
        action_type: 'view_student_daily_log',
        metadata: { viewedStudentId: studentId },
        created_at: new Date(),
      });

      // Return the all logs to the client.
      res.json(logs);

    } catch (err) {
      console.log(err);
      res.status(500).json({ error: err.message });
    }
  }

  return {
    fetchSupportDailyLog,
  };
};

module.exports = activityLogController;
