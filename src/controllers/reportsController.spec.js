const reportsController = require('./reportsController');
const {
    mockReq,
    mockRes,
    mockUser,
    mongoHelper: { dbConnect, dbDisconnect },
  } = require('../test');
  const { hasPermission } = require('../utilities/permissions');

test('two plus two is four', () => {
    expect(2 + 2).toBe(4);
  });
