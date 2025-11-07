const ApplicationTime = require('../models/applicationTime');

// ----------------------------
// Controller Object
// ----------------------------
const applicationTimeController = {};

// ----------------------------
// Helper: Mark Outliers
// ----------------------------
const detectOutliers = async (role, thresholdHours = 1) => {
  const thresholdSeconds = thresholdHours * 3600;

  await ApplicationTime.updateMany(
    {
      role,
      timeTaken: { $gt: thresholdSeconds },
      isOutlier: false
    },
    { $set: { isOutlier: true } }
  );
};

// ----------------------------
// Helper: Format Time Nicely
// ----------------------------
const formatTime = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

// ----------------------------
// GET /application-time
// ----------------------------
applicationTimeController.getApplicationTimeAnalytics = async (req, res) => {
  try {
    // Optional: Permission check - only check if requestor exists (public endpoints don't have one)
    if (
      req.body?.requestor?.role &&
      !['Owner', 'Administrator'].includes(req.body.requestor.role)
    ) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { startDate, endDate, roles } = req.query;

    const baseQuery = { isOutlier: false };

    // Filter by date range
    if (startDate && endDate) {
      baseQuery.appliedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Filter by roles - handle both array and comma-separated string formats
    if (roles) {
      let rolesArray;
      if (Array.isArray(roles)) {
        rolesArray = roles;
      } else if (typeof roles === 'string') {
        // Handle format: [role1,role2] or role1,role2
        rolesArray = roles.replace(/[\[\]]/g, '').split(',').map(r => r.trim()).filter(r => r);
      }
      if (rolesArray && rolesArray.length > 0) {
        baseQuery.role = { $in: rolesArray };
      }
    }

    // ⚠️ MongoDB doesn’t support `$median` in $group, so we handle it manually
    const aggregationPipeline = [
      { $match: baseQuery },
      {
        $group: {
          _id: '$role',
          averageTimeSeconds: { $avg: '$timeTaken' },
          totalApplications: { $sum: 1 },
          minTime: { $min: '$timeTaken' },
          maxTime: { $max: '$timeTaken' },
          allTimes: { $push: '$timeTaken' }
        }
      },
      { $sort: { averageTimeSeconds: -1 } },
      {
        $project: {
          _id: 0,
          role: '$_id',
          averageTimeSeconds: { $round: ['$averageTimeSeconds', 2] },
          totalApplications: 1,
          minTime: 1,
          maxTime: 1,
          allTimes: 1
        }
      }
    ];

    let results = await ApplicationTime.aggregate(aggregationPipeline);

    // Compute median manually
    results = results.map((r) => {
      const sorted = r.allTimes.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      delete r.allTimes;

      return {
        ...r,
        medianTime: Math.round(median * 100) / 100,
        averageTimeMinutes: Math.round((r.averageTimeSeconds / 60) * 100) / 100,
        averageTimeHours: Math.round((r.averageTimeSeconds / 3600) * 100) / 100,
        formattedTime: formatTime(r.averageTimeSeconds)
      };
    });

    // Handle empty data
    if (!results.length) {
      return res.status(200).json({
        message: 'No application time data found for the specified criteria',
        data: [],
        summary: {
          totalRoles: 0,
          totalApplications: 0,
          dateRange: startDate && endDate ? { startDate, endDate } : null
        }
      });
    }

    // Summary
    const totalApplications = results.reduce(
      (sum, item) => sum + item.totalApplications,
      0
    );
    const overallAverage =
      results.reduce(
        (sum, item) =>
          sum + item.averageTimeSeconds * item.totalApplications,
        0
      ) / totalApplications;

    // Normalize roles before sending the response
        let normalizedRoles = ['All'];
        if (roles) {
        normalizedRoles = Array.isArray(roles) ? roles : roles.split(',');
        }

        // Format data for chart (most time-consuming roles first, already sorted)
        // Data is sorted by averageTimeSeconds descending (most time-consuming first)
        const chartData = results.map((item) => ({
          role: item.role,
          timeToApply: item.averageTimeSeconds, // Time in seconds (frontend can convert to appropriate units)
          timeToApplyMinutes: item.averageTimeMinutes,
          timeToApplyFormatted: item.formattedTime,
          totalApplications: item.totalApplications
        }));

        return res.status(200).json({
          data: chartData,
          summary: {
            totalRoles: results.length,
            totalApplications,
            overallAverageTime: Math.round(overallAverage * 100) / 100,
            overallAverageFormatted: formatTime(overallAverage),
            dateRange: startDate && endDate ? { startDate, endDate } : null,
            filters: {
              roles: normalizedRoles,
              outlierThreshold: '1 hour'
            }
          }
        });

  } catch (error) {
    console.error('Error fetching application time analytics:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ----------------------------
// POST /application-time
// ----------------------------
applicationTimeController.trackApplicationTime = async (req, res) => {
  try {
    const {
      role,
      userId,
      jobId,
      jobTitle,
      clickedAt,
      appliedAt,
      sessionId,
      deviceType = 'desktop',
      location = { country: 'Unknown', state: 'Unknown' }
    } = req.body;

    // Validate required fields
    if (!role || !userId || !jobId || !jobTitle || !clickedAt || !appliedAt || !sessionId) {
      return res.status(400).json({
        error:
          'Missing required fields: role, userId, jobId, jobTitle, clickedAt, appliedAt, sessionId'
      });
    }

    const clickedTime = new Date(clickedAt);
    const appliedTime = new Date(appliedAt);
    const timeTaken = Math.round((appliedTime - clickedTime) / 1000);
    const isOutlier = timeTaken > 3600;

    const applicationTimeInstance = new ApplicationTime({
      role,
      userId,
      jobId,
      jobTitle,
      clickedAt: clickedTime,
      appliedAt: appliedTime,
      timeTaken,
      sessionId,
      deviceType,
      location,
      isOutlier
    });

    await applicationTimeInstance.save();

    return res.status(201).json({
      success: true,
      message: 'Application time tracked successfully',
      data: {
        id: applicationTimeInstance._id,
        timeTaken,
        timeTakenFormatted: formatTime(timeTaken),
        isOutlier
      }
    });
  } catch (error) {
    console.error('Error tracking application time:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ----------------------------
// GET /application-time/roles
// ----------------------------
applicationTimeController.getAvailableRoles = async (req, res) => {
  try {
    const roles = await ApplicationTime.distinct('role');
    return res.status(200).json({ success: true, data: roles });
  } catch (error) {
    console.error('Error fetching available roles:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ----------------------------
// POST /application-time/detect-outliers
// ----------------------------
applicationTimeController.detectOutliersManually = async (req, res) => {
  try {
    // Only check permissions if requestor exists (public endpoints don't have one)
    if (
      req.body?.requestor?.role &&
      !['Owner', 'Administrator'].includes(req.body.requestor.role)
    ) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { thresholdHours = 1, role } = req.query;

    if (role) {
      await detectOutliers(role, thresholdHours);
    } else {
      const roles = await ApplicationTime.distinct('role');
      await Promise.all(
        roles.map((roleName) => detectOutliers(roleName, thresholdHours))
      );      
    }

    return res.status(200).json({
      message: 'Outlier detection completed successfully',
      thresholdHours,
      role: role || 'All roles'
    });
  } catch (error) {
    console.error('Error detecting outliers:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = applicationTimeController;