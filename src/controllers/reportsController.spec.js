const reportsController = require('./reportsController');
const UserProfile = require('../models/userProfile');

const { mockReq, mockRes, assertResMock } = require('../test');

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

const flushPromises = () => new Promise(setImmediate);

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

  describe('reportsController module', () => {

    beforeAll(() => {
      
    });
  
    beforeEach(() => {
      
    });
  
    afterEach(() => {
      
    });
  
    afterAll(async () => {
      
    });

    describe('getWeeklySummaries method', () => {

      test("Ensure getWeeklySummaries returns 403 if the user doesn't have getWeeklySummaries permission", async () =>  {
        const { getWeeklySummaries } = makeSut();
        
        const hasPermissionSpy = mockHasPermission(false);
        console.log(hasPermissionSpy);
        getWeeklySummaries(mockReq, mockRes);
        await flushPromises();
        
        const response = await getWeeklySummaries(mockReq, mockRes);

        expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'getWeeklySummaries');
        assertResMock(
          403,
          {
            error: 'You are not authorized to create new badges.',
          },
          response,
          mockRes,
        );
      });

    });

  });