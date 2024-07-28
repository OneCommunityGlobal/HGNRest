const assertResMock = (statusCode, message, response, mockRes) => {
  console.log(mockRes);
  expect(mockRes.status).toHaveBeenCalledWith(statusCode);
  expect(mockRes.send).toHaveBeenCalledWith(message);
  expect(response).toBeUndefined();
};

module.exports = { assertResMock };
