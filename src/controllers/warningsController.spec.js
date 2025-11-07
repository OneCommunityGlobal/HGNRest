
const warningsController = require('./warningsController');
const currentWarnings = require('../models/currentWarnings');

const UserProfile = require('../models/userProfile');
const { mockReq, mockRes } = require('../test');

jest.mock('../models/currentWarnings', () => ({
  find: jest.fn(),
}));

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
    beforeEach(() => {
      // Needed because of removing hardcoded warnings from warningsController
      currentWarnings.find.mockResolvedValue([
        { warningTitle: 'Better Descriptions', abbreviation: null },
        { warningTitle: 'Log Time to Tasks', abbreviation: null },
        { warningTitle: 'Log Time as You Go', abbreviation: null },
        { warningTitle: 'Log Time to Action Items', abbreviation: null },
        { warningTitle: 'Intangible Time Log w/o Reason', abbreviation: null },
        { warningTitle: 'Blu Sq Rmvd - Hrs Close Enoug', abbreviation: 'RBS4HCE', isSpecial: true },
      ]);
    });

    test('Ensure getWarningsByUserId  Returns error 400 if warning with the user id given is not found', async () => {
      const { getWarningsByUserId } = makeSut();

      jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => Promise.resolve(null));
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
              abbreviation: null,
            },
            {
              title: 'Log Time to Tasks',
              warnings: [],
              abbreviation: null,
            },
            {
              title: 'Log Time as You Go',
              warnings: [],
              abbreviation: null,
            },
            {
              title: 'Log Time to Action Items',
              warnings: [],
              abbreviation: null,
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
              abbreviation: null,
            },
            {
              title: 'Blu Sq Rmvd - Hrs Close Enoug',
              warnings: [],
              abbreviation: 'RBS4HCE',
            },
          ],
        },
        response,
      );
    });
  });

  describe('post warnings to user profile method', () => {
    beforeEach(() => {
      // Needed because of removing hardcoded warnings from warningsController
      currentWarnings.find.mockResolvedValue([
        { warningTitle: 'Better Descriptions', abbreviation: null },
        { warningTitle: 'Log Time to Tasks', abbreviation: null },
        { warningTitle: 'Log Time as You Go', abbreviation: null },
        { warningTitle: 'Log Time to Action Items', abbreviation: null },
        { warningTitle: 'Intangible Time Log w/o Reason', abbreviation: null },
        { warningTitle: 'Blu Sq Rmvd - Hrs Close Enoug', abbreviation: 'RBS4HCE', isSpecial: true },
      ]);
    });

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

      jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });

      const res = await postWarningsToUserProfile(mockReq, mockRes);
      assertResMock(400, { message: errorMessage }, res);
    });

    test('Ensure postWarningsToUserProfile Returns error 400 if saving the warnings errors', async () => {
      const { postWarningsToUserProfile } = makeSut();
      const errorMessage = 'error occured';
      jest
        .spyOn(UserProfile, 'findByIdAndUpdate')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMessage)));

      const res = await postWarningsToUserProfile(mockReq, mockRes);

      assertResMock(400, { message: errorMessage }, res);
    });

    // Currently needing rework, when tested, date is reset, and color is set to white instead of red
    // test('Ensure postWarningsToUserProfile Returns a 201 if the warnings are saved successfully', async () => {
    //   const { postWarningsToUserProfile } = makeSut();
    //   const successMessage = 'success';

    //   mockReq.body = {
    //     iconId: '39452633-40ff-4fba-a648-d24b2a48af03',
    //     userId: '5a7e21f00317bc1538def4b7',
    //     color: 'red',
    //     date: '2025-05-05T06:28:24.865Z',
    //     description: 'Intangible Time Log w/o Reason',
    //   };

    //   const profile = {
    //     warnings: [],
    //     // save: jest.fn().mockResolvedValue(true),
    //   };

    //   jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => Promise.resolve(profile));

    //   // jest.spyOn(UserProfile, 'findByIdAndUpdate').mockImplementationOnce(() =>
    //   //   Promise.resolve(true)
    //   // );

    //   // Mock the updated profile to match what controller expects
    //   jest.spyOn(UserProfile, 'findByIdAndUpdate').mockImplementationOnce(() =>
    //     Promise.resolve({
    //       _id: mockReq.body.userId,
    //       warnings: [
    //         {
    //           userId: mockReq.body.userId,
    //           iconId: mockReq.body.iconId,
    //           color: mockReq.body.color,
    //           date: mockReq.body.date,
    //           description: mockReq.body.description,
    //         },
    //       ],
    //     })
    //   );

    //   // const res = await sut.postWarningsToUserProfile(mockReq, mockRes);
    //   const res = await postWarningsToUserProfile(mockReq, mockRes);

    //   assertResMock(
    //     201,
    //     {
    //       message: successMessage,
    //       warnings: [
    //         { title: 'Better Descriptions', warnings: [], abbreviation: null, },
    //         { title: 'Log Time to Tasks', warnings: [], abbreviation: null, },
    //         { title: 'Log Time as You Go', warnings: [], abbreviation: null, },
    //         { title: 'Log Time to Action Items', warnings: [], abbreviation: null, },
    //         {
    //           title: 'Intangible Time Log w/o Reason',
    //           warnings: [
    //             {
    //               userId: mockReq.body.userId,
    //               iconId: mockReq.body.iconId,
    //               color: mockReq.body.color,
    //               date: mockReq.body.date,
    //               description: mockReq.body.description,
    //             },
    //           ],
    //           abbreviation: null,
    //         },
    //         { title: 'Blu Sq Rmvd - Hrs Close Enoug', warnings: [], abbreviation: 'RBS4HCE' },
    //       ],
    //     },
    //     res,
    //   );
    // });
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
            abbreviation: null,
          },
          {
            title: 'Log Time to Tasks',
            warnings: [],
            abbreviation: null,
          },
          {
            title: 'Log Time as You Go',
            warnings: [],
            abbreviation: null,
          },
          {
            title: 'Log Time to Action Items',
            warnings: [],
            abbreviation: null,
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
            abbreviation: null,
          },
          {
            title: 'Blu Sq Rmvd - Hrs Close Enoug',
            warnings: [],
            abbreviation: 'RBS4HCE',
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
              abbreviation: null,
            },
            {
              title: 'Log Time to Tasks',
              warnings: [],
              abbreviation: null,
            },
            {
              title: 'Log Time as You Go',
              warnings: [],
              abbreviation: null,
            },
            {
              title: 'Log Time to Action Items',
              warnings: [],
              abbreviation: null,
            },
            {
              title: 'Intangible Time Log w/o Reason',
              warnings: [],
              abbreviation: null,
            },
            {
              title: 'Blu Sq Rmvd - Hrs Close Enoug',
              warnings: [],
              abbreviation: 'RBS4HCE',
            },
          ],
        },
        res,
      );
    });
  });
});
