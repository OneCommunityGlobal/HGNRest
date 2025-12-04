const JobHitsAndApplications = require('../../models/jobAnalytics/JobHitsAndApplications');

const jobHitsAndApplicationsController = function () {
  const mapHitsAndApplicationsToRole = (data) => {
    const roleMap = data.reduce((acc, item) => {
      const { role, hit, applied } = item;

      if (!acc[role]) {
        acc[role] = {
          role,
          hits: 0,
          applications: 0,
        };
      }

      if (hit) acc[role].hits += 1;
      if (applied) acc[role].applications += 1;

      return acc;
    }, {});

    return Object.values(roleMap);
  };

  const createJobHitsAndApplications = async (req, res) => {
    try {
      const rows = req.body;

      rows.forEach(async (row) => {
        const newJobHitsAndApplications = new JobHitsAndApplications({
          ...row,
          date: new Date(row.date),
        });
        await newJobHitsAndApplications.save();
      });

      return res.status(201).json({ message: 'Data added successfully' });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };

  const getJobHitsAndApplications = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;

      const query = {};

      if (startDate) query.date = { $gte: new Date(startDate) };
      if (endDate) query.date = { ...query.date, $lte: new Date(endDate) };
      if (roles) query.role = { $in: roles.split(',') };

      const jobHitsAndApplicationsData = await JobHitsAndApplications.find(query).sort({ date: 1 });

      const jobResults = mapHitsAndApplicationsToRole(jobHitsAndApplicationsData);

      return res.status(200).json(jobResults);
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };

  return {
    createJobHitsAndApplications,
    getJobHitsAndApplications,
  };
};

module.exports = jobHitsAndApplicationsController;
