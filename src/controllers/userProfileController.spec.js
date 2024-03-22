const userProfileController = require('./userProfileController');
const {
  mockReq,
  mockRes,
  mockUser,
  mongoHelper: { dbConnect, dbDisconnect },
} = require('../test');
const helper = require('../utilities/permissions');
const UserProfile = require('../models/userProfile');
const escapeRegex = require('../utilities/escapeRegex');

jest.mock('node-fetch');

// eslint-disable-next-line import/no-extraneous-dependencies, import/order
const fetch = require('node-fetch');

// const { Response } = jest.requireActual('node-fetch');

const makeSut = () => {
  const { postUserProfile } = userProfileController(UserProfile);

  return {
    postUserProfile,
  };
};

const assertResMock = (statusCode, message, response) => {
  expect(mockRes.status).toHaveBeenCalledWith(statusCode);
  expect(mockRes.send).toHaveBeenCalledWith(message);
  expect(response).toBeUndefined();
};

describe('userProfileController module', () => {
  beforeAll(async () => {
    await dbConnect();
  });

  beforeEach(() => {
    mockReq.body.role = 'any_role';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await dbDisconnect();
  });

  describe('postUserProfile function', () => {
    test("Ensure postUserProfile returns 403 if user doesn't have permissions for postUserProfile", async () => {
      const { postUserProfile } = makeSut();

      jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(false));

      const response = await postUserProfile(mockReq, mockRes);

      assertResMock(403, 'You are not authorized to create new users', response);
    });

    test("Ensure postUserProfile returns 403 if user doesn't have permissions for addDeleteEditOwners or if the user role is owner", async () => {
      const { postUserProfile } = makeSut();

      mockReq.body.role = 'Owner';

      jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true))
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await postUserProfile(mockReq, mockRes);

      assertResMock(403, 'You are not authorized to create new owners', response);
    });

    test('Ensure postUserProfile returns 400 if the email address is already in use', async () => {
      const { postUserProfile } = makeSut();

      jest.spyOn(helper, 'hasPermission').mockImplementation(() => Promise.resolve(true));

      const findOneSpy = jest
        .spyOn(UserProfile, 'findOne')
        .mockImplementationOnce(() => mockUser());

      const newMockReq = {
        body: {
          ...mockReq.body,
          ...mockUser(),
        },
      };

      const response = await postUserProfile(newMockReq, mockRes);

      expect(findOneSpy).toHaveBeenCalledWith({
        email: {
          $regex: escapeRegex(newMockReq.body.email),
          $options: 'i',
        },
      });

      assertResMock(
        400,
        {
          error: 'That email address is already in use. Please choose another email address.',
          type: 'email',
        },
        response,
      );
    });

    test(`Ensure postUserProfile returns error 400 if in dev environment, 
        the role is owner or administrator and the actual email or password are incorrect`, async () => {
      const { postUserProfile } = makeSut();

      jest.spyOn(helper, 'hasPermission').mockImplementation(() => Promise.resolve(true));

      jest.spyOn(UserProfile, 'findOne').mockImplementationOnce(() => null);

      const newMockReq = {
        body: {
          ...mockReq.body,
          ...mockUser(),
        },
      };

      newMockReq.body.role = 'Owner';

      process.env.dbName = 'hgnData_dev';

      const errorResponse = {
        ok: false,
      };

      fetch.mockImplementationOnce(() => errorResponse);

      const response = await postUserProfile(newMockReq, mockRes);

      assertResMock(
        400,
        {
          error:
            'The actual email or password you provided is incorrect. Please enter the actual email and password associated with your account in the Main HGN app.',
          type: 'credentials',
        },
        response,
      );
    });

    test(`Ensure postUserProfile returns 400 if the firstname and lastname already exist 
        and if no duplicate name is allowed`, async () => {
      const { postUserProfile } = makeSut();

      jest.spyOn(helper, 'hasPermission').mockImplementation(() => Promise.resolve(true));

      jest
        .spyOn(UserProfile, 'findOne')
        .mockImplementationOnce(() => null)
        .mockImplementationOnce(() => mockUser());

      const newMockReq = {
        body: {
          ...mockReq.body,
          ...mockUser(),
        },
      };

      newMockReq.body.allowsDuplicateName = false;

      const response = await postUserProfile(newMockReq, mockRes);

      assertResMock(
        400,
        {
          error: 'That name is already in use. Please confirm if you want to use this name.',
          type: 'name',
        },
        response,
      );

      newMockReq.body.allowsDuplicateName = true;

      const saveSpy = jest
        .spyOn(UserProfile.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error()));

      await postUserProfile(newMockReq, mockRes);

      expect(saveSpy).toHaveBeenCalled();
    });

    // test('Ensure postUserProfile returns error 501 if there is an error when trying to create the userProfile', async () => {
    //     const { postUserProfile } = makeSut();

    //     jest.spyOn(helper, 'hasPermission').mockImplementation(() => Promise.resolve(true));

    //     jest
    //         .spyOn(UserProfile, 'findOne')
    //         .mockImplementationOnce(() => null)
    //         .mockImplementationOnce(() => mockUser());

    //     const errorMsg = 'any_error';

    //     jest
    //         .spyOn(UserProfile.prototype, 'save')
    //         .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

    //     const newMockReq = {
    //         body: {
    //             ...mockReq.body,
    //             ...mockUser(),
    //         },
    //     };

    //     newMockReq.body.allowsDuplicateName = true;

    //     const response = await postUserProfile(newMockReq, mockRes);

    //     assertResMock(501, new Error(errorMsg).toString(), response);
    // });

    // test('Ensure postUserProfile returns 200 if the userProfile is saved', async () => {
    //     const { postUserProfile } = makeSut();

    //     jest.spyOn(helper, 'hasPermission').mockImplementation(() => Promise.resolve(true));

    //     jest.spyOn(UserProfile, 'findOne').mockImplementation(() => Promise.resolve(null));

    //     const newMockReq = {
    //         body: {
    //             ...mockReq.body,
    //             ...mockUser(),
    //         },
    //     };

    //     const response = await postUserProfile(newMockReq, mockRes);

    //     const userProfileSaved = await UserProfile.findOne({
    //         email: {
    //             $regex: escapeRegex(newMockReq.body.email),
    //             $options: 'i',
    //         },
    //     });

    //     const saved = userProfileSaved.toJSON();

    //     expect(saved.role).toBe(newMockReq.body.role);
    //     expect(saved.firstName).toBe(newMockReq.body.firstName);
    //     expect(saved.lastName).toBe(newMockReq.body.lastName);
    //     expect(saved.jobTitle).toEqual(newMockReq.body.jobTitle);
    //     expect(saved.phoneNumber).toEqual(newMockReq.body.phoneNumber);
    //     expect(saved.bio).toBe(newMockReq.body.bio);
    //     expect(saved.weeklycommittedHours).toBe(newMockReq.body.weeklycommittedHours);
    //     expect(saved.weeklycommittedHoursHistory[0].hours).toBe(newMockReq.body.weeklycommittedHours);
    //     expect(saved.personalLinks).toEqual(newMockReq.body.personalLinks);
    //     expect(saved.adminLinks).toEqual(newMockReq.body.adminLinks);
    //     expect(saved.teams).toEqual(newMockReq.body.teams);
    //     expect(saved.projects).toEqual(newMockReq.body.projects);
    //     expect(saved.createdDate).toEqual(new Date(newMockReq.body.createdDate));
    //     expect(saved.email).toBe(newMockReq.body.email);
    //     expect(saved.weeklySummaries[0].summary).toBe(newMockReq.body.weeklySummaries[0].summary);
    //     expect(saved.weeklySummariesCount).toBe(newMockReq.body.weeklySummariesCount);
    //     expect(saved.weeklySummaryOption).toBe(newMockReq.body.weeklySummaryOption);
    //     expect(saved.mediaUrl).toBe(newMockReq.body.mediaUrl);
    //     expect(saved.collaborationPreference).toBe(newMockReq.body.collaborationPreference);
    //     expect(saved.timeZone).toBe(newMockReq.body.timeZone);
    //     expect(saved.weeklySummaryOption).toBe(newMockReq.body.weeklySummaryOption);
    //     expect(saved.location).toEqual(newMockReq.body.location);
    //     expect(saved.permissions).toEqual(newMockReq.body.permissions);
    //     expect(saved.bioPosted).toBe(newMockReq.body.bioPosted);
    //     expect(saved.isFirstTimelog).toBe(newMockReq.body.isFirstTimelog);
    //     expect(saved.actualEmail).toBe(newMockReq.body.actualEmail);
    //     expect(saved.isVisible).toBe(newMockReq.body.isVisible);

    //     assertResMock(
    //         200,
    //         {
    //             _id: userProfileSaved._id,
    //         },
    //         response,
    //     );
    // });
  });
});
