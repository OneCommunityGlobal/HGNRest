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

const FAQ = require('../models/faqs');
const UserProfile = require('../models/userProfile');
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

  // Test Case 1: searchFAQs - Successful Search
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

    it('should handle errors when searching FAQs', async () => {
      mockReq.query.q = 'findme';
      FAQ.find.mockReturnValue({
        limit: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await faqController.searchFAQs(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Error searching FAQs',
        error: expect.any(Error),
      });
    });
  });

  // Test Case 2: getAllFAQs - Successful Fetch
  describe('getAllFAQs', () => {
    it('should return all FAQs sorted by creation date', async () => {
      const mockFAQs = [
        { question: 'FAQ 1', answer: 'Answer 1', createdAt: new Date('2024-01-01') },
        { question: 'FAQ 2', answer: 'Answer 2', createdAt: new Date('2024-01-02') },
      ];
      FAQ.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockFAQs),
      });

      await faqController.getAllFAQs(mockReq, mockRes);

      expect(FAQ.find).toHaveBeenCalled();
      expect(FAQ.find().sort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockFAQs);
    });

    it('should handle errors when fetching FAQs', async () => {
      FAQ.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await faqController.getAllFAQs(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Error fetching FAQs',
        error: expect.any(Error),
      });
    });
  });

  // Test Case 3: getFAQHistory - FAQ Found with Populated History
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

    it('should return 404 when FAQ is not found', async () => {
      mockReq.params.id = 'nonexistent';
      FAQ.findById.mockResolvedValue(null);

      await faqController.getFAQHistory(mockReq, mockRes);

      expect(FAQ.findById).toHaveBeenCalledWith('nonexistent');
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'FAQ not found' });
    });

    it('should handle errors when fetching FAQ history', async () => {
      mockReq.params.id = 'faq123';
      FAQ.findById.mockRejectedValue(new Error('Database error'));

      await faqController.getFAQHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error fetching FAQ history' });
    });
  });
});