const mockHasPermission = jest.fn();

jest.mock('../utilities/permissions', () => ({
  hasPermission: (...args) => mockHasPermission(...args),
}));
jest.mock('../helpers/reporthelper', () => () => ({
  weeklySummaries: jest.fn().mockResolvedValue([]),
  formatSummaries: () => [{ _id: 'user1' }],
}));

const reportsController = require('./reportsController');

describe('getWeeklySummaries access', () => {
  test.each([
    ['getWeeklySummaries', 200],
    ['requestBio', 200],
    ['getReports', 403],
  ])('with only %s responds %s', async (permission, status) => {
    mockHasPermission.mockImplementation(async (requestor, action) => action === permission);
    const req = {
      body: { requestor: { requestorId: 'user1', role: 'Volunteer' } },
      query: { week: '1', forceRefresh: 'true' },
      headers: {},
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn(), set: jest.fn() };

    await reportsController().getWeeklySummaries(req, res);

    expect(res.status).toHaveBeenCalledWith(status);
  });
});
