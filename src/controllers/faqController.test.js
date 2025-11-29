const {
  searchFAQs,
  getAllFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  logUnansweredFAQ,
  answerUnansweredFAQ,
  getUnansweredFAQs,
  deleteUnansweredFAQ
} = require('../controllers/faqController');

const FAQ = require('../models/faqs');
const UnansweredFAQ = require('../models/unansweredFaqs');
const UserProfile = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');
const jwt = require('jsonwebtoken');

jest.mock('../models/faqs');
jest.mock('../models/unansweredFaqs');
jest.mock('../models/userProfile');
jest.mock('../utilities/emailSender');
jest.mock('jsonwebtoken');

const mockReq = (data = {}) => ({
  query: {},
  params: {},
  body: {},
  headers: {},
  ...data
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  send = jest.fn().mockReturnValue(res);
  return res;
};

describe('FAQ Controller Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Get All FAQs
  test('getAllFAQs returns list of FAQs', async () => {
    const req = mockReq();
    const res = mockRes();

    FAQ.find.mockReturnValue({ sort: jest.fn().mockReturnValue([{ question: "Q1" }]) });

    await getAllFAQs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ question: "Q1" }]);
  });

  // Search FAQs
  test('searchFAQs returns filtered FAqs', async () => {
    const req = mockReq({ query: { q: "mission" } });
    const res = mockRes();

    FAQ.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue([{ question: "mission" }]) })
    });

    await searchFAQs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // Create FAQ
  test('createFAQ creates FAQ when user has permission', async () => {
    jwt.verify.mockReturnValue({
      userid: "123",
      role: "Admin",
      permissions: { frontPermissions: [], backPermissions: ['manageFAQs'] },
      expiryTimestamp: Date.now() + 100000
    });

    FAQ.prototype.save = jest.fn().mockResolvedValue(true);

    const req = mockReq({
      headers: { authorization: "token" },
      body: { question: "New Q", answer: "New A" }
    });

    const res = mockRes();

    await createFAQ(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // Update FAQ
  test('updateFAQ updates an existing FAQ', async () => {
    jwt.verify.mockReturnValue({
      userid: "123",
      role: "Admin",
      permissions: { frontPermissions: [], backPermissions: ['manageFAQs'] },
      expiryTimestamp: Date.now() + 100000
    });

    const mockFaq = {
      question: "Old Q",
      answer: "Old A",
      changeHistory: [],
      save: jest.fn()
    };

    FAQ.findById = jest.fn().mockResolvedValue(mockFaq);

    const req = mockReq({
      headers: { authorization: "token" },
      params: { id: "1" },
      body: { question: "Updated Q", answer: "Updated A" }
    });

    const res = mockRes();
    await updateFAQ(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // Delete FAQ
  test('deleteFAQ deletes faq', async () => {
    FAQ.findByIdAndDelete.mockResolvedValue({ id: "1" });

    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await deleteFAQ(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // Log Unanswered FAQ
  test('logUnansweredFAQ logs new unanswered question', async () => {
    jwt.verify.mockReturnValue({
      userid: "123",
      role: "User",
      permissions: { frontPermissions: [], backPermissions: [] },
      expiryTimestamp: Date.now() + 100000
    });

    UnansweredFAQ.findOne.mockResolvedValue(null);
    UnansweredFAQ.prototype.save = jest.fn().mockResolvedValue(true);

    UserProfile.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ email: "owner@test.com" }])
    });

    emailSender.mockResolvedValue(true);

    const req = mockReq({
      headers: { authorization: "token" },
      body: { question: "Why sky blue?" }
    });
    const res = mockRes();

    await logUnansweredFAQ(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // Answer Unanswered FAQ
  test('answerUnansweredFAQ converts unanswered to FAQ', async () => {
    jwt.verify.mockReturnValue({
      userid: "123",
      role: "Admin",
      permissions: { frontPermissions: [], backPermissions: ['manageFAQs'] },
      expiryTimestamp: Date.now() + 100000
    });

    UnansweredFAQ.findById.mockResolvedValue({
      question: "Unanswered?",
      delete: jest.fn()
    });

    FAQ.prototype.save = jest.fn().mockResolvedValue(true);
    UnansweredFAQ.findByIdAndDelete = jest.fn().mockResolvedValue(true);

    const req = mockReq({
      headers: { authorization: 'token' },
      params: { id: "1" },
      body: { answer: "Because..." }
    });

    const res = mockRes();
    await answerUnansweredFAQ(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // Get Unanswered List
  test('getUnansweredFAQs returns unanswered list', async () => {
    UnansweredFAQ.find.mockReturnValue({
      sort: jest.fn().mockReturnValue([{ question: "Q?" }])
    });

    const req = mockReq();
    const res = mockRes();

    await getUnansweredFAQs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // Delete Unanswered
  test('deleteUnansweredFAQ deletes entry', async () => {
    UnansweredFAQ.findByIdAndDelete.mockResolvedValue(true);

    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await deleteUnansweredFAQ(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

});
