// __tests__/faqController.test.js

// Mock dependencies
jest.mock('../models/faqs');
jest.mock('../models/unansweredFaqs');
jest.mock('../models/role');
jest.mock('../models/userProfile');
jest.mock('../utilities/emailSender');
jest.mock('jsonwebtoken');

// Mock config
jest.mock('../config', () => ({
  JWT_SECRET: 'testsecret',
}));

const jwt = require('jsonwebtoken');
const config = require('../config');
const FAQ = require('../models/faqs');
const UnansweredFAQ = require('../models/unansweredFaqs');
const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');
const faqController = require('./faqController');

describe('FAQ Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      headers: {},
      query: {},
      body: {},
      params: {},
      user: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  // Test Case 1: verifyToken - Successful Verification
  describe('verifyToken', () => {
    it('should successfully verify a valid token and set req.user', async () => {
      const mockDecodedToken = {
        userid: 'user123',
        role: 'admin',
        expiryTimestamp: Date.now() + 3600000,
        permissions: {
          frontPermissions: ['viewDashboard'],
          backPermissions: ['manageUsers'],
        },
      };
      const mockRolePermissions = ['readData'];
      mockReq.headers.authorization = 'validToken123';
      jwt.verify.mockReturnValue(mockDecodedToken);
      Role.findOne.mockResolvedValue({ roleName: 'admin', permissions: mockRolePermissions });

      await faqController.verifyToken(mockReq);

      expect(jwt.verify).toHaveBeenCalledWith('validToken123', config.JWT_SECRET);
      expect(Role.findOne).toHaveBeenCalledWith({ roleName: 'admin' });
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userid).toBe('user123');
      expect(mockReq.user.role).toBe('admin');
      expect(mockReq.user.permissions).toEqual(expect.arrayContaining([
        ...mockRolePermissions,
        ...mockDecodedToken.permissions.frontPermissions,
        ...mockDecodedToken.permissions.backPermissions,
      ]));
    });
  });

  // Test Case 3: searchFAQs - Successful Search
  describe('searchFAQs', () => {
    it('should return a list of FAQs matching the search query', async () => {
      mockReq.query.q = 'findme';
      const mockResults = [
        { question: 'findme: test1', answer: 'ans1' },
        { question: 'another test findme', answer: 'ans2' },
      ];
      FAQ.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockResults),
      });

      await faqController.searchFAQs(mockReq, mockRes);

      expect(FAQ.find).toHaveBeenCalledWith({
        question: { $regex: 'findme', $options: 'i' },
      });
      expect(FAQ.find().limit).toHaveBeenCalledWith(5);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockResults);
    });
  });

  // Test Case 5: getFAQHistory - FAQ Found with Populated History
  describe('getFAQHistory', () => {
    it('should return FAQ details and its change history with populated names', async () => {
      mockReq.params.id = 'faq123';
      const mockDateCreatedAt = new Date('2024-01-01T00:00:00.000Z');
      const mockDateUpdatedAt = new Date('2024-01-02T00:00:00.000Z');

      const mockFAQData = {
        _id: 'faq123',
        question: 'Original Question',
        answer: 'Original Answer',
        createdBy: 'creatorUserId',
        createdAt: mockDateCreatedAt,
        changeHistory: [
          {
            updatedBy: 'updaterUserId1',
            updatedAt: mockDateUpdatedAt,
            previousQuestion: 'Old Q',
            previousAnswer: 'Old A',
            updatedQuestion: 'Original Question',
            updatedAnswer: 'Original Answer',
          },
        ],
      };
      FAQ.findById.mockResolvedValue(mockFAQData);

      UserProfile.findById
        .mockImplementation(id => {
          if (id === 'creatorUserId') return { select: jest.fn().mockResolvedValue({ firstName: 'Creator', lastName: 'User' }) };
          if (id === 'updaterUserId1') return { select: jest.fn().mockResolvedValue({ firstName: 'Updater', lastName: 'One' }) };
          return { select: jest.fn().mockResolvedValue(null) };
        });

      await faqController.getFAQHistory(mockReq, mockRes);

      expect(FAQ.findById).toHaveBeenCalledWith('faq123');
      expect(UserProfile.findById).toHaveBeenCalledWith('creatorUserId');
      expect(UserProfile.findById).toHaveBeenCalledWith('updaterUserId1');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        question: 'Original Question',
        answer: 'Original Answer',
        createdBy: 'Creator User',
        createdAt: mockDateCreatedAt,
        changeHistory: [
          {
            updatedBy: 'Updater One',
            updatedAt: mockDateUpdatedAt,
            previousQuestion: 'Old Q',
            previousAnswer: 'Old A',
            updatedQuestion: 'Original Question',
            updatedAnswer: 'Original Answer',
          },
        ],
      });
    });
  });
});