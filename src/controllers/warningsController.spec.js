


const UserProfile = require('../models/userProfile');
const { mockReq, mockRes } = require('../test');
const warningsController = require('./warningsController');

const makeSut = () => {
  const { getWarningsByUserId, postWarningsToUserProfile, deleteUsersWarnings } =
    warningsController(UserProfile);

  return {
    getWarningsByUserId,
    postWarningsToUserProfile,
    deleteUsersWarnings,
  };
};

const assertResMock = (statusCode, message, response) => {
  expect(mockRes.status).toHaveBeenCalledWith(statusCode);
  expect(mockRes.send).toHaveBeenCalledWith(message);
  expect(response).toBeUndefined();
};


describe('warnings controller module', () => {



  describe('delete users warnings method', () => {
    test('Ensure deleteUsersWarnings returns error 401 if findOneAndUpdate fails', async () => {
      const { deleteUsersWarnings } = makeSut();
      const errorMessage = 'error occured';
      jest
        .spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMessage)));
      const res = await deleteUsersWarnings(mockReq, mockRes);
      assertResMock(401, { message: errorMessage }, res);
    });

    test('Ensure deleteUsersWarnings returns error 400 if the user profile doesnt exist', async () => {
      const { deleteUsersWarnings } = makeSut();
      const errorMessage = 'no valid records';
      jest
        .spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(null));
      const res = await deleteUsersWarnings(mockReq, mockRes);
      assertResMock(400, { message: errorMessage }, res);
    },5000);
  });
});
