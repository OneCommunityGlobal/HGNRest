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
  describe('Less than 5 Blue Squares ', () => {
    it('should not assign blue square if no missed hours', async () => {});
    it('should only carry forward missed hours without additional hours', async () => {});
  });
  describe('More than 5 Blue Squares ', () => {
    it('should not assign blue square if no missed hours', async () => {});
    it('should only carry forward missed hours with additional hours', async () => {});
    it('should not assign assign extra hours(only missed hours are added) if this is the 5th blue square', async () => {});
  });
});
