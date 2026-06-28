const ApplicationTimeModel = require('../../models/jobAnalytics/applicationTime');

const applicationTimeController = function () {
  const getApplicationTimes = async (req, res) => {
    try {
      const { startDate, roles } = req.query;

      const query = {};

      // add startDate to query
      if (startDate) query.createdAt = { $gte: new Date(startDate) };

      // add roles to query
      if (roles) {
        const roleList = roles.split(',').map((role) => role.trim());
        if (roleList.length > 0) query.role = { $in: roleList };
      }

      const applicationTimes = await ApplicationTimeModel.find(query);

      return res.status(200).json({
        data: applicationTimes,
        count: applicationTimes.length,
      });
    } catch (error) {
      res.status(400).json({ error: 'failed to fetch application times. Please try again later.' });
    }
  };

  return {
    getApplicationTimes,
  };
};

module.exports = applicationTimeController;
