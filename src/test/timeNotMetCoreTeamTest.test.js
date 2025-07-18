const { expect } = require('chai');
const sinon = require('sinon');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const moment = require('moment-timezone');

// Import dependencies and the module to test
const userHelper = require('../helpers/userHelper')();
const userProfile = require('../models/userProfile');
const dashboardHelper = require('../helpers/dashboardhelper')();
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');

describe('Time Not Met Core Team Test', () => {
  // All core team users
  // 1. No missed hours
  // 2. Some missed hours but less than 5 blue squares
  // 3. More than 5 blue squares with no missed hours
  // 4. More than 5 blue squares with some missed hours
  describe('Less than 5 Blue Squares ', () => {});
  describe('More than 5 Blue Squares ', () => {});
});
