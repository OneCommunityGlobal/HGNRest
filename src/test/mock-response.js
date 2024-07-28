const mockRes = {
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
};

module.exports = mockRes;
