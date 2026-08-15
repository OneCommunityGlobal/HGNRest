const UserProfile = require('../models/userProfile');
const overviewReportHelper = require('./overviewReportHelper');

// const makeSut = () => {
//   const { getVolunteerNumberStats } = overviewReportHelper();

//   return { getVolunteerNumberStats };
// };

describe('overviewReportHelper tests', () => {
  describe('getHoursStats worked-hours distribution', () => {
    const originalTimezone = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTimezone;
      jest.restoreAllMocks();
    });

    test.each(['UTC', 'America/New_York', 'Asia/Tokyo'])(
      'uses exact selected-date boundaries in %s',
      async (timezone) => {
        process.env.TZ = timezone;
        const entries = [
          { dateOfWork: '2026-07-18', totalSeconds: 50 * 3600 },
          { dateOfWork: '2026-07-19', totalSeconds: 5 * 3600 },
          { dateOfWork: '2026-07-25', totalSeconds: 6 * 3600 },
          { dateOfWork: '2026-07-26', totalSeconds: 50 * 3600 },
          { dateOfWork: '2026-07-19', totalSeconds: 100 * 3600, entryType: 'person' },
          { dateOfWork: '2026-07-20', totalSeconds: 100 * 3600, entryType: 'team' },
          { dateOfWork: '2026-07-21', totalSeconds: 100 * 3600, entryType: 'project' },
        ];

        jest.spyOn(UserProfile, 'aggregate').mockImplementation(async (pipeline) => {
          const conditions = pipeline[3].$project.timeEntries.$filter.cond.$and;
          const startDate = conditions[0].$gte[1];
          const endDate = conditions[1].$lte[1];
          const excludedEntryTypes = conditions[2].$not[0].$in[1];
          return [
            {
              _id: 'volunteer-id',
              timeEntries: entries.filter(
                (entry) =>
                  entry.dateOfWork >= startDate &&
                  entry.dateOfWork <= endDate &&
                  !excludedEntryTypes.includes(entry.entryType),
              ),
            },
          ];
        });

        const { getHoursStats } = overviewReportHelper();
        const result = await getHoursStats('2026-07-19', '2026-07-25');

        expect(result).toEqual([
          { _id: '10', count: 0 },
          { _id: '20', count: 1 },
          { _id: '30', count: 0 },
          { _id: '40', count: 0 },
          { _id: '50', count: 0 },
          { _id: '50+', count: 0 },
        ]);
      },
    );

    it('uses the same active, committed-hours, and non-Mentor eligibility rules as the total', async () => {
      const aggregate = jest.spyOn(UserProfile, 'aggregate').mockResolvedValue([]);

      const { getHoursStats } = overviewReportHelper();
      await getHoursStats('2026-07-19', '2026-07-25');

      expect(aggregate.mock.calls[0][0][0]).toEqual({
        $match: {
          isActive: true,
          weeklycommittedHours: { $gte: 1 },
          role: { $ne: 'Mentor' },
        },
      });
    });

    it('returns the latest six worked-hours buckets', async () => {
      jest.spyOn(UserProfile, 'aggregate').mockResolvedValue(
        [5, 15, 25, 35, 45, 55].map((hours, index) => ({
          _id: `volunteer-${index}`,
          timeEntries: [
            { dateOfWork: '2026-07-19', totalSeconds: hours * 3600, entryType: 'default' },
          ],
        })),
      );

      const { getHoursStats } = overviewReportHelper();
      const result = await getHoursStats('2026-07-19', '2026-07-25');

      expect(result).toEqual([
        { _id: '10', count: 1 },
        { _id: '20', count: 1 },
        { _id: '30', count: 1 },
        { _id: '40', count: 1 },
        { _id: '50', count: 1 },
        { _id: '50+', count: 1 },
      ]);
    });
  });

  describe('getCommittedHoursStats committed-hours distribution', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('preserves the PR #2238 active-user query and bucket boundaries', async () => {
      const select = jest.fn().mockResolvedValue([
        { weeklycommittedHours: 9 },
        { weeklycommittedHours: 10 },
        { weeklycommittedHours: 19.5 },
        { weeklycommittedHours: 20 },
        { weeklycommittedHours: 30 },
        { weeklycommittedHours: 40 },
        { weeklycommittedHours: 40.5 },
      ]);
      const find = jest.spyOn(UserProfile, 'find').mockReturnValue({ select });

      const { getCommittedHoursStats } = overviewReportHelper();
      const result = await getCommittedHoursStats();

      expect(find).toHaveBeenCalledWith({ isActive: true });
      expect(select).toHaveBeenCalledWith('weeklycommittedHours');
      expect(result).toEqual([
        { _id: 10, count: 2 },
        { _id: 20, count: 1 },
        { _id: 30, count: 1 },
        { _id: 40, count: 1 },
        { _id: '40+', count: 1 },
      ]);
    });
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
