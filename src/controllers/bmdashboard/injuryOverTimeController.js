const mongoose = require('mongoose');
const InjuryOverTime = require('../../models/bmdashboard/buildingInjuryOverTime');

const parseCommaSeparatedValues = (value, mapper = (item) => item) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(mapper);

exports.getInjuryOverTime = async (req, res) => {
  try {
    const { projectIds, startDate, endDate, types, departments, severities } = req.query;

    const query = {};

    if (projectIds) {
      const projectIdArray = parseCommaSeparatedValues(projectIds);

      if (!projectIdArray.every((id) => mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ error: 'One or more projectIds are invalid' });
      }

      query.projectId = {
        $in: projectIdArray.map((id) => mongoose.Types.ObjectId(id)),
      };
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (types) {
      query.injuryType = { $in: parseCommaSeparatedValues(types) };
    }

    if (departments) {
      query.department = { $in: parseCommaSeparatedValues(departments) };
    }

    if (severities) {
      query.severity = { $in: parseCommaSeparatedValues(severities) };
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
            month: {
              $dateToString: {
                format: '%Y-%m-01',
                date: '$date',
              },
            },
          },
          count: { $sum: '$count' },
        },
      },
      {
        $project: {
          _id: 0,
          projectId: '$_id.projectId',
          severity: '$_id.severity',
          injuryType: '$_id.injuryType',
          department: '$_id.department',
          date: { $toDate: '$_id.month' },
          count: 1,
        },
      },
      {
        $sort: {
          date: 1,
          projectId: 1,
          severity: 1,
          injuryType: 1,
          department: 1,
        },
      },
    ]);

    res.status(200).json(injuries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
