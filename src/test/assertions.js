const assertResMock = (statusCode, message, response, mockRes) => {
  expect(mockRes.status).toHaveBeenCalledWith(statusCode);
  expect(mockRes.send).toHaveBeenCalledWith(message);
  expect(response).toBeUndefined();
};

module.exports = { assertResMock };
