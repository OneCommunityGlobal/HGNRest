const mongoose = require('mongoose');
const InjuryCategory = require('../../models/bmdashboard/buildingInjury');

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const {
      projectIds = '',
      startDate,
      endDate,
      severities = '',
      types = '',
    } = req.query;

    const matchStage = {};

    const projectIdArray = projectIds
      .split(',')
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => mongoose.Types.ObjectId(id));
    if (projectIdArray.length) {
      matchStage.projectId = { $in: projectIdArray };
    }

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const severityArray = severities.split(',').filter(Boolean);
    if (severityArray.length) {
      matchStage.severity = { $in: severityArray };
    }

    const typeArray = types.split(',').filter(Boolean);
    if (typeArray.length) {
      matchStage.injuryType = { $in: typeArray };
    }

    const results = await InjuryCategory.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            projectName: '$projectName',
            workerCategory: '$workerCategory',
          },
          totalInjuries: { $sum: '$count' },
        },
      },
      {
        $project: {
          _id: 0,
          projectName: '$_id.projectName',
          workerCategory: '$_id.workerCategory',
          totalInjuries: 1,
        },
      },
    ]);

    return res.status(200).json(results);
  } catch (err) {
    console.error('[getCategoryBreakdown] Error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getUniqueSeverities = async (req, res) => {
  try {
    const severities = await InjuryCategory.distinct('severity');
    res.status(200).json(severities.filter(Boolean));
  } catch (err) {
    console.error('[getUniqueSeverities] Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getUniqueInjuryTypes = async (req, res) => {
  try {
    const types = await InjuryCategory.distinct('injuryType');
    res.status(200).json(types.filter(Boolean));
  } catch (err) {
    console.error('[getUniqueInjuryTypes] Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};