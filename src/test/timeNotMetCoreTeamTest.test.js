const { expect } = require('chai');
const sinon = require('sinon');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const moment = require('moment-timezone');

// Import dependencies and the module to test
const userHelper = require('../helpers/userHelper');
const userProfile = require('../models/userProfile');
const dashboardHelper = require('../helpers/dashboardhelper')();
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');
