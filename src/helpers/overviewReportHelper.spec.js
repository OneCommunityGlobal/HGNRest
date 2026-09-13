const UserProfile = require('../models/userProfile');
const Task = require('../models/task');
const overviewReportHelper = require('./overviewReportHelper');

// const makeSut = () => {
//   const { getVolunteerNumberStats } = overviewReportHelper();

//   return { getVolunteerNumberStats };
// };

describe('overviewReportHelper tests', () => {
  describe('getTasksStats date boundaries', () => {
    afterEach(() => jest.restoreAllMocks());

    test('filters the non-comparison totals by the selected date range', async () => {
      const startDate = new Date('2026-07-19T00:00:00-07:00');
      const endDate = new Date('2026-07-25T23:59:00-07:00');
      const aggregateSpy = jest.spyOn(Task, 'aggregate').mockResolvedValue([]);

      const { getTasksStats } = overviewReportHelper();
      await getTasksStats(startDate, endDate);

      expect(aggregateSpy).toHaveBeenCalledWith([
        { $match: { modifiedDatetime: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
    });
  });

  describe('getHoursStats date boundaries', () => {
    const originalTimezone = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTimezone;
      jest.restoreAllMocks();
    });

    test.each(['UTC', 'America/New_York', 'Asia/Tokyo'])(
      'uses the same current, previous, and custom date boundaries in %s',
      async (timezone) => {
        process.env.TZ = timezone;

        const entries = [
          { dateOfWork: '2026-07-04', totalSeconds: 50 * 3600 },
          { dateOfWork: '2026-07-05', totalSeconds: 5 * 3600 },
          { dateOfWork: '2026-07-11', totalSeconds: 6 * 3600 },
          { dateOfWork: '2026-07-12', totalSeconds: 50 * 3600 },
          { dateOfWork: '2026-07-18', totalSeconds: 50 * 3600 },
          { dateOfWork: '2026-07-19', totalSeconds: 5 * 3600 },
          { dateOfWork: '2026-07-25', totalSeconds: 6 * 3600 },
          { dateOfWork: '2026-07-26', totalSeconds: 5 * 3600 },
          { dateOfWork: '2026-07-31', totalSeconds: 6 * 3600 },
          { dateOfWork: '2026-08-01', totalSeconds: 50 * 3600 },
        ];

        jest.spyOn(UserProfile, 'aggregate').mockImplementation(async (pipeline) => {
          const conditions = pipeline[3].$project.timeEntries.$filter.cond.$and;
          const startDate = conditions[0].$gte[1];
          const endDate = conditions[1].$lte[1];
          return [
            {
              _id: 'volunteer-id',
              timeEntries: entries.filter(
                (entry) => entry.dateOfWork >= startDate && entry.dateOfWork <= endDate,
              ),
            },
          ];
        });

        const { getHoursStats } = overviewReportHelper();
        const ranges = [
          ['2026-07-26', '2026-07-31'], // Current week
          ['2026-07-19', '2026-07-25'], // Previous week
          ['2026-07-05', '2026-07-11'], // Custom range
        ];

        const results = await Promise.all(
          ranges.map(([startDate, endDate]) => getHoursStats(startDate, endDate)),
        );

        results.forEach((result) => {
          expect(result).toEqual([
            { _id: '10', count: 0 },
            { _id: '20', count: 1 },
            { _id: '30', count: 0 },
            { _id: '40', count: 0 },
            { _id: '50', count: 0 },
            { _id: '50+', count: 0 },
          ]);
        });
      },
    );
  });

  describe('getTotalHoursWorked date boundaries', () => {
    const originalTimezone = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTimezone;
      jest.restoreAllMocks();
    });

    test.each(['UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'])(
      'uses the exact inclusive date strings in %s',
      async (timezone) => {
        process.env.TZ = timezone;
        let appliedStartDate;
        let appliedEndDate;
        const entries = [
          { dateOfWork: '2026-07-18', totalSeconds: 50 * 3600 },
          { dateOfWork: '2026-07-19', totalSeconds: 5 * 3600 },
          { dateOfWork: '2026-07-25', totalSeconds: 6 * 3600 },
          { dateOfWork: '2026-07-26', totalSeconds: 50 * 3600 },
        ];

        jest.spyOn(UserProfile, 'aggregate').mockImplementation(async (pipeline) => {
          const conditions = pipeline[2].$project.timeEntryData.$filter.cond.$and;
          const [startCondition, endCondition] = conditions;
          [, appliedStartDate] = startCondition.$gte;
          [, appliedEndDate] = endCondition.$lte;
          const totalSeconds = entries
            .filter(
              (entry) => entry.dateOfWork >= appliedStartDate && entry.dateOfWork <= appliedEndDate,
            )
            .reduce((total, entry) => total + entry.totalSeconds, 0);
          return [{ totaltime_hrs: totalSeconds / 3600 }];
        });

        const { getTotalHoursWorked } = overviewReportHelper();
        const result = await getTotalHoursWorked('2026-07-19', '2026-07-25');

        expect(appliedStartDate).toBe('2026-07-19');
        expect(appliedEndDate).toBe('2026-07-25');
        expect(result).toEqual({ current: 11 });
      },
    );
  });
});

// describe('overviewReportHelper method tests', () => {
//   const startDate = '2024-05-26T00:00:00Z';
//   const endDate = '2024-06-02T00:00:00Z';
//
//   describe('getVolunteerNumberStats method', () => {
//     test('it should call the aggregation method on UserProfile', async () => {
//       const { getVolunteerNumberStats } = makeSut();
//       const aggregateSpy = jest.spyOn(UserProfile, 'aggregate').mockImplementationOnce(() => null);
//
//       await getVolunteerNumberStats(startDate, endDate);
//
//       expect(aggregateSpy).toHaveBeenCalled();
//     });
//
//     test('it should call the aggregation query with the correct parameters', async () => {
//       const { getVolunteerNumberStats } = makeSut();
//       const aggregateSpy = jest.spyOn(UserProfile, 'aggregate').mockImplementationOnce(() => null);
//
//       await getVolunteerNumberStats(startDate, endDate);
//
//       expect(aggregateSpy).toHaveBeenCalled();
//       expect(aggregateSpy).toHaveBeenCalledWith([
//         {
//           $facet: {
//             activeVolunteers: [{ $match: { isActive: true } }, { $count: 'activeVolunteersCount' }],
//
//             newVolunteers: [
//               {
//                 $match: {
//                   createdDate: {
//                     $gte: startDate,
//                     $lte: endDate,
//                   },
//                 },
//               },
//               { $count: 'newVolunteersCount' },
//             ],
//
//             deactivatedVolunteers: [
//               {
//                 $match: {
//                   $and: [
//                     { lastModifiedDate: { $gte: startDate } },
//                     { lastModifiedDate: { $lte: endDate } },
//                     { isActive: false },
//                   ],
//                 },
//               },
//             ],
//           },
//         },
//       ]);
//     });
//   });
// });
