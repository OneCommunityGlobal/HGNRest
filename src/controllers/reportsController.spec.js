const reportsController = require('./reportsController');
const UserProfile = require('../models/userProfile');
const {
  mockReq,
  mockRes,
  assertResMock
} = require('../test');
const helper = require('../utilities/permissions');

jest.mock('../helpers/reporthelper');
const reporthelper = require('../helpers/reporthelper');
const userhelper = require('../helpers/userHelper');

const makeSut = () => {
  const { getWeeklySummaries, getReportRecipients, deleteReportsRecepients, saveReportsRecepients } = reportsController(UserProfile);

  return {
    getWeeklySummaries,
    getReportRecipients,
    deleteReportsRecepients,
    saveReportsRecepients
  };
};

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

  describe('reportsController module', () => {

    describe('getWeeklySummaries method', () => {

      test("Ensure getWeeklySummaries returns 403 if the user doesn't have getWeeklySummaries permission", async () =>  {
        const { getWeeklySummaries } = makeSut();
        
        const hasPermissionSpy = mockHasPermission(false);

        const response = await getWeeklySummaries(mockReq, mockRes);

        expect(hasPermissionSpy).toHaveBeenCalledWith(
          mockReq.body.requestor,
          'getWeeklySummaries',
        );
        assertResMock(403, 'You are not authorized to view all users', response, mockRes);
      });

    });

  });