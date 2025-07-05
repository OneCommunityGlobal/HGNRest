const mongoose = require('mongoose');
const moment = require('moment-timezone');
const userhelper = require('../helpers/userHelper')();

// Mock all external dependencies
jest.mock('../models/userProfile');
jest.mock('../helpers/dashboardHelper');
jest.mock('../startup/logger');
jest.mock('../utilities/emailSender');

const userProfile = require('../models/userProfile');
const dashboardHelper = require('../helpers/dashboardhelper');
const logger = require('../startup/logger');

describe('Blue Square Assignment System', () => {
  let mockVolunteer;
  let mockCoreTeamMember;

  beforeAll(() => {
    // Setup consistent mock data
    mockVolunteer = {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      isActive: true,
      weeklycommittedHours: 10,
      weeklySummaries: [],
      missedHours: 0,
      role: 'Volunteer',
      infringements: [],
      email: 'volunteer@example.com',
    };

    mockCoreTeamMember = {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
      isActive: true,
      weeklycommittedHours: 15,
      weeklySummaries: [],
      missedHours: 2,
      role: 'Core Team',
      infringements: Array(6).fill({
        date: '2023-01-01',
        description: 'Previous infringement',
      }),
      email: 'core@example.com',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await mongoose.disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
});
