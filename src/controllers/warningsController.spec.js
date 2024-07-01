const warningsController = require('./warningsController');

const UserProfile = require('../models/userProfile');
const { mockReq, mockRes } = require('../test');

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
  describe('get warnings to from user profile method', () => {
    test('Ensure getWarningsByUserId  Returns error 400 if warning with the user id given is not found', async () => {
      const { getWarningsByUserId } = makeSut();

      jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => Promise.resolve([]));
      const response = await getWarningsByUserId(mockReq, mockRes);
      assertResMock(400, { message: 'no valiud records' }, response);
    });

    test('Ensure getWarningsByUserId Returns error 401 if there is any error while retrieving a warning object', async () => {
      const { getWarningsByUserId } = makeSut();
      const errorMessage = 'error occured';
      jest
        .spyOn(UserProfile, 'findById')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMessage)));

      const response = await getWarningsByUserId(mockReq, mockRes);

      assertResMock(401, { message: errorMessage }, response);
    });

    test('Ensure getWarningsByUserId Returns 201 if a warning was found given the user id', async () => {
      const { getWarningsByUserId } = makeSut();

      const foundUser = {
        warnings: [
          {
            date: '2021-09-01T00:00:00.000Z',
            description: 'Intangible Time Log w/o Reason',
            color: 'white',
          },
        ],
      };

      jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => Promise.resolve(foundUser));
      const response = await getWarningsByUserId({ ...mockReq }, mockRes);
      assertResMock(
        201,
        {
          warnings: [
            {
              title: 'Better Descriptions',
              warnings: [],
            },
            {
              title: 'Log Time to Tasks',
              warnings: [],
            },
            {
              title: 'Log Time as You Go',
              warnings: [],
            },
            {
              title: 'Log Time to Action Items',
              warnings: [],
            },
            {
              title: 'Intangible Time Log w/o Reason',
              warnings: [
                {
                  date: '2021-09-01T00:00:00.000Z',
                  description: 'Intangible Time Log w/o Reason',
                  color: 'white',
                },
              ],
            },
          ],
        },
        response,
      );
    });
  });

  describe('post warnings to user profile method', () => {
    test('Ensure postWarningsToUserProfile returns error 400 if the user profile doesnt exist', async () => {
      const { postWarningsToUserProfile } = makeSut();
      const errorMessage = 'No valid records found';
      jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => Promise.resolve(null));
      const res = await postWarningsToUserProfile(mockReq, mockRes);
      assertResMock(400, { message: errorMessage }, res);
    });

    test('Ensure postWarningsToUserProfile Returns error 400 if findById errors', async () => {
      const { postWarningsToUserProfile } = makeSut();
      const errorMessage = 'error occured when finding the users warnings';
      jest
        .spyOn(UserProfile, 'findById')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMessage)));
      const res = await postWarningsToUserProfile(mockReq, mockRes);
      assertResMock(400, { message: errorMessage }, res);
    });

    test('Ensure postWarningsToUserProfile Returns error 400 if saving the warnings errors', async () => {
      const errorMessage = 'error occured when saving the users warnings';

      const { postWarningsToUserProfile } = makeSut();
      const profile = {
        warnings: [],
        save: () => {},
      };
      mockReq.body.iconId = 'iconId';
      mockReq.body.userId = '5a7e21f00317bc1538def4b7';
      mockReq.body.color = 'red';
      mockReq.body.date = new Date().toISOString();
      mockReq.body.description = 'Intangible Time Log w/o Reason';

      jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => Promise.resolve(profile));
      jest
        .spyOn(profile, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMessage)));

      const res = await postWarningsToUserProfile(mockReq, mockRes);
      assertResMock(400, { message: errorMessage }, res);
    });
    test('Ensure postWarningsToUserProfile Returns a 201 if the warnings are saved successfully', async () => {
      const { postWarningsToUserProfile } = makeSut();
      const successMessage = 'success';

      mockReq.body.iconId = '39452633-40ff-4fba-a648-d24b2a48af03';
      mockReq.body.userId = '5a7e21f00317bc1538def4b7';
      mockReq.body.color = 'red';
      mockReq.body.date = new Date().toISOString();
      mockReq.body.description = 'Intangible Time Log w/o Reason';

      const newWarning = {
        date: new Date().toISOString(),
        description: 'Intangible Time Log w/o Reason',
        color: 'red',
        userId: '5a7e21f00317bc1538def4b7',
        iconId: '39452633-40ff-4fba-a648-d24b2a48af03',
      };

      const profile = {
        warnings: [],
        save: () => {},
        filterWarnings: () => {},
      };

      jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => Promise.resolve(profile));
      jest.spyOn(profile, 'save').mockImplementationOnce(() => Promise.resolve(true));

      const res = await postWarningsToUserProfile(mockReq, mockRes);
      assertResMock(
        201,
        {
          message: successMessage,
          warnings: [
            { title: 'Better Descriptions', warnings: [] },
            { title: 'Log Time to Tasks', warnings: [] },
            { title: 'Log Time as You Go', warnings: [] },
            { title: 'Log Time to Action Items', warnings: [] },
            { title: 'Intangible Time Log w/o Reason', warnings: [newWarning] },
          ],
        },
        res,
      );
    });
  });

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
    });

    test("Ensure deleteUsersWarnings returns a 201 if the user's warnings are deleted successfully", async () => {
      const { deleteUsersWarnings } = makeSut();
      const successMessage = 'succesfully deleted';
      const profile = {
        warnings: [
          {
            title: 'Better Descriptions',
            warnings: [],
          },
          {
            title: 'Log Time to Tasks',
            warnings: [],
          },
          {
            title: 'Log Time as You Go',
            warnings: [],
          },
          {
            title: 'Log Time to Action Items',
            warnings: [],
          },
          {
            title: 'Intangible Time Log w/o Reason',
            warnings: [
              {
                date: '2021-09-01T00:00:00.000Z',
                description: 'Intangible Time Log w/o Reason',
                color: 'white',
              },
            ],
          },
        ],
      };
      jest
        .spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve(profile));
      const res = await deleteUsersWarnings(mockReq, mockRes);
      assertResMock(
        201,
        {
          message: successMessage,
          warnings: [
            {
              title: 'Better Descriptions',
              warnings: [],
            },
            {
              title: 'Log Time to Tasks',
              warnings: [],
            },
            {
              title: 'Log Time as You Go',
              warnings: [],
            },
            {
              title: 'Log Time to Action Items',
              warnings: [],
            },
            {
              title: 'Intangible Time Log w/o Reason',
              warnings: [],
            },
          ],
        },
        res,
      );
    });
  });
});
