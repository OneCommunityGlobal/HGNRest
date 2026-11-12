const buildCoreTeamMissedHoursAggregation = (startOfLastWeek, endOfLastWeek, cutOffDate) => [
  {
    $match: {
      role: 'Core Team',
      isActive: true,
    },
  },
  {
    $lookup: {
      from: 'timeEntries',
      let: { userId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$personId', '$$userId'] },
                { $eq: ['$isTangible', true] },
                { $gte: ['$dateOfWork', startOfLastWeek] },
                { $lte: ['$dateOfWork', endOfLastWeek] },
              ],
            },
          },
        },
      ],
      as: 'timeEntries',
    },
  },
  {
    $project: {
      _id: 1,
      missedHours: {
        $let: {
          vars: {
            baseMissedHours: {
              $max: [
                {
                  $subtract: [
                    {
                      $sum: [{ $ifNull: ['$missedHours', 0] }, '$weeklycommittedHours'],
                    },
                    {
                      $divide: [
                        {
                          $sum: {
                            $map: {
                              input: '$timeEntries',
                              in: '$$this.totalSeconds',
                            },
                          },
                        },
                        3600,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
            infringementsAdjustment: {
              $max: [
                0,
                {
                  $subtract: [
                    {
                      $max: [
                        0,
                        {
                          $subtract: [
                            {
                              $size: {
                                $filter: {
                                  input: { $ifNull: ['$infringements', []] },
                                  as: 'inf',
                                  cond: { $gte: ['$$inf.date', cutOffDate] },
                                },
                              },
                            },
                            5,
                          ],
                        },
                      ],
                    },
                    {
                      $max: [
                        0,
                        {
                          $subtract: [
                            {
                              $size: {
                                $filter: {
                                  input: { $ifNull: ['$infringements', []] },
                                  as: 'inf',
                                  cond: { $gte: ['$$inf.date', cutOffDate] },
                                },
                              },
                            },
                            6,
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          in: {
            $cond: [
              { $gt: ['$$baseMissedHours', 0] },
              { $add: ['$$baseMissedHours', '$$infringementsAdjustment'] },
              '$$baseMissedHours',
            ],
          },
        },
      },
    },
  },
];

module.exports = {
  buildCoreTeamMissedHoursAggregation,
};
