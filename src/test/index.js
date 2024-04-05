const mockReq = require('./mock-request');
const mockRes = require('./mock-response');
const mockUser = require('./mockUserProfileController');
const mongoHelper = require('./db/mongo-helper');
const createTestPermissions = require('./createTestPermissions');
const createUser = require('./db/createUser');

module.exports = {
  mockReq,
  mockRes,
  mockUser,
  mongoHelper,
  createTestPermissions,
  createUser,
};
