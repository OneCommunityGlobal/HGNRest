// HGNRest/src/services/applications.service.js
const Application = require('../models/application');

async function aggregateByCountry(range, roles) {
  const roleMatch = roles?.length ? { role: { $in: roles } } : {};

  return Application.aggregate([
    // Cast timestamp -> _ts as Date when it's a string, otherwise keep as-is
    {
      $addFields: {
        _ts: {
          $cond: [
            { $eq: [{ $type: '$timestamp' }, 'string'] },
            { $toDate: '$timestamp' },
            '$timestamp',
          ],
        },
      },
    },
    { $match: { ...roleMatch, _ts: { $gte: range.start, $lte: range.end } } },
    { $group: { _id: '$country', count: { $sum: '$numberOfApplicants' } } },
    { $project: { _id: 0, country: '$_id', count: 1 } },
    { $sort: { count: -1 } },
  ]);
}

module.exports = { aggregateByCountry };
