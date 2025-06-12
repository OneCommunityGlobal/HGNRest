const overviewReportHelper = require('./overviewReportHelper');
const UserProfile = require('../models/userProfile');

const makeSut = () => {
  const { getVolunteerNumberStats } = overviewReportHelper();

  return { getVolunteerNumberStats };
};

describe('overviewReportHelper tests', () => {
  it("Fix this test suite", () => {})
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
