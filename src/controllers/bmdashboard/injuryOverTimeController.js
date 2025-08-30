const mongoose = require('mongoose');
const InjuryOverTime = require('../../models/bmdashboard/buildingInjuryOverTime');

exports.getInjuryOverTime = async (req, res) => {
  try {
    const { projectIds, startDate, endDate, types, departments, severities } = req.query;

    const query = {};

    if (projectIds) {
      const projectIdArray = projectIds.split(',').map((id) => mongoose.Types.ObjectId(id));
      query.projectId = { $in: projectIdArray };
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (types) {
      const typesArray = types.split(',');
      query.injuryType = { $in: typesArray };
    }

    if (departments) {
      const departmentsArray = departments.split(',');
      query.department = { $in: departmentsArray };
    }

    if (severities) {
      const severitiesArray = severities.split(',');
      query.severity = { $in: severitiesArray };
    }

    const injuries = await InjuryOverTime.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            projectId: '$projectId',
            severity: '$severity',
            injuryType: '$injuryType',
            department: '$department',
          },
          count: { $sum: '$count' },
          date: { $first: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          projectId: '$_id.projectId',
          severity: '$_id.severity',
          injuryType: '$_id.injuryType',
          department: '$_id.department',
          date: 1,
          count: 1,
        },
      },
    ]);

    res.status(200).json(injuries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
