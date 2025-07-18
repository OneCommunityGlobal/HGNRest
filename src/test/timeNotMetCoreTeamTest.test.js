const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const moment = require('moment-timezone');

// Import dependencies and the module to test
const userHelper = require('../helpers/userHelper')();
const userProfile = require('../models/userProfile');
const dashboardHelper = require('../helpers/dashboardhelper')();
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');

// Mock
jest.mock('../helpers/dashboardHelper');
jest.mock('../utilities/emailSender');
jest.mock('../startup/logger');

describe('Time Not Met Core Team Test', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Less than 5 Blue Squares ', () => {
    it.todo('should not assign blue square if no missed hours');
    it.todo('should only carry forward missed hours without additional hours');
  });
  describe('More than 5 Blue Squares ', () => {
    it.todo('should not assign blue square if no missed hours');
    it.todo('should only carry forward missed hours with additional hours');
    it.todo(
      'should not assign assign extra hours(only missed hours are added) if this is the 5th blue square',
    );
  });
});
