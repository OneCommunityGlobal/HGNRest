const cron = require('node-cron');
const analyticsService = require('../services/analyticsService');
const FormResponse = require('../models/formResponse');

// Refresh metrics for active students daily at 2 AM
const scheduleDaily = () => {
  cron.schedule(
    '0 2 * * *',
    async () => {
      try {
        // Find distinct recent students and recompute
        const since = new Date();
        since.setDate(since.getDate() - 7); // active in last 7 days

        const recentStudents = await FormResponse.distinct('submittedBy', {
          submittedAt: { $gte: since },
        });

        await Promise.all(
          recentStudents.map(async (studentId) => {
            try {
              await analyticsService.computeStudentMetrics(studentId);
            } catch (err) {
              // non-blocking per-student errors
              console.error(`Failed to compute metrics for ${studentId}:`, err);
            }
          }),
        );
      } catch (error) {
        console.error('Student metrics job failed:', error);
      }
    },
    { timezone: 'America/Los_Angeles' },
  );
};

module.exports = { scheduleDaily };
