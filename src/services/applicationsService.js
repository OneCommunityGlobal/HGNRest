const Application = require('../models/application');

async function aggregateByCountry(range, roles) {
  const roleMatch = roles?.length ? { role: { $in: roles } } : {};

  return Application.aggregate([
    // Normalize any string timestamps → Date
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

async function getMapAnalytics(range, roles, options = {}) {
  const roleMatch = roles?.length ? { role: { $in: roles } } : {};
  const { includeMetadata = false, groupByRegion = false } = options;

  const pipeline = [
    // Normalize timestamps
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
    // Match criteria
    { $match: { ...roleMatch, _ts: { $gte: range.start, $lte: range.end } } },
  ];

  if (groupByRegion) {
    pipeline.push(
      {
        $group: {
          _id: '$region',
          count: { $sum: '$numberOfApplicants' },
          countries: { $addToSet: '$country' },
          countryNames: { $addToSet: '$countryName' },
        },
      },
      {
        $project: {
          _id: 0,
          region: '$_id',
          count: 1,
          countries: 1,
          countryNames: 1,
        },
      },
    );
  } else {
    pipeline.push(
      {
        $group: {
          _id: '$country',
          count: { $sum: '$numberOfApplicants' },
          countryName: { $first: '$countryName' },
          region: { $first: '$region' },
          roles: { $addToSet: '$role' },
          ...(includeMetadata && {
            jobIds: { $addToSet: '$jobId' },
            applicationSources: { $addToSet: '$applicationSource' },
            avgApplicantsPerEntry: { $avg: '$numberOfApplicants' },
          }),
        },
      },
      {
        $project: {
          _id: 0,
          country: '$_id',
          count: 1,
          countryName: 1,
          region: 1,
          roles: 1,
          ...(includeMetadata && {
            jobIds: 1,
            applicationSources: 1,
            avgApplicantsPerEntry: 1,
          }),
        },
      },
    );
  }

  pipeline.push({ $sort: { count: -1 } });

  return Application.aggregate(pipeline);
}

async function getComparisonData(currentRange, previousRange, roles) {
  const roleMatch = roles?.length ? { role: { $in: roles } } : {};

  const [current, previous] = await Promise.all([
    Application.aggregate([
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
      { $match: { ...roleMatch, _ts: { $gte: currentRange.start, $lte: currentRange.end } } },
      {
        $group: {
          _id: '$country',
          count: { $sum: '$numberOfApplicants' },
          countryName: { $first: '$countryName' },
        },
      },
      { $project: { _id: 0, country: '$_id', count: 1, countryName: 1 } },
    ]),
    Application.aggregate([
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
      { $match: { ...roleMatch, _ts: { $gte: previousRange.start, $lte: previousRange.end } } },
      {
        $group: {
          _id: '$country',
          count: { $sum: '$numberOfApplicants' },
        },
      },
      { $project: { _id: 0, country: '$_id', count: 1 } },
    ]),
  ]);

  // Create comparison map
  const prevMap = new Map(previous.map((r) => [r.country, r.count]));
  const comparisonData = {};

  let currentTotal = 0;
  let previousTotal = 0;

  current.forEach(({ country, count, countryName }) => {
    currentTotal += count;
    const prevCount = prevMap.get(country) || 0;
    previousTotal += prevCount;

    let percentageChange;
    if (prevCount === 0) {
      percentageChange = count === 0 ? 0 : 100;
    } else {
      percentageChange = ((count - prevCount) / prevCount) * 100;
    }

    comparisonData[country] = {
      current: count,
      previous: prevCount,
      percentageChange: Math.round(percentageChange * 100) / 100,
      countryName,
    };
  });

  // Add countries that only existed in previous period
  previous.forEach(({ country }) => {
    if (!(country in comparisonData)) {
      comparisonData[country] = {
        current: 0,
        previous: prevMap.get(country),
        percentageChange: -100,
        countryName: null,
      };
    }
  });

  // Calculate overall percentage change
  let overallPercentageChange;
  if (previousTotal === 0) {
    overallPercentageChange = currentTotal > 0 ? 100 : 0;
  } else {
    overallPercentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
  }

  return {
    comparisonData,
    totals: {
      current: currentTotal,
      previous: previousTotal,
      percentageChange: Math.round(overallPercentageChange * 100) / 100,
    },
  };
}

async function getRoleStatistics(range) {
  return Application.aggregate([
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
    { $match: { _ts: { $gte: range.start, $lte: range.end } } },
    {
      $group: {
        _id: '$role',
        count: { $sum: '$numberOfApplicants' },
        uniqueCountries: { $addToSet: '$country' },
        avgApplicantsPerEntry: { $avg: '$numberOfApplicants' },
      },
    },
    {
      $project: {
        _id: 0,
        role: '$_id',
        count: 1,
        uniqueCountries: 1,
        countryCount: { $size: '$uniqueCountries' },
        avgApplicantsPerEntry: 1,
      },
    },
    { $sort: { count: -1 } },
  ]);
}

module.exports = {
  aggregateByCountry,
  getMapAnalytics,
  getComparisonData,
  getRoleStatistics,
};
