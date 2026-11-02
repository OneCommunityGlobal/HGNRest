const mongoose = require('mongoose');

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

jest.mock('../models/hgnFormResponse', () => ({
  findOne: jest.fn(),
}));

const { hasPermission } = require('../utilities/permissions');
const HgnFormResponses = require('../models/hgnFormResponse');
const userSkillsProfileController = require('./userSkillsProfileController');

const USER_ID = '507f1f77bcf86cd799439011';

const makeQuery = (result) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeRequest = () => ({
  body: {
    requestor: {
      requestorId: USER_ID,
    },
  },
  params: {
    userId: USER_ID,
  },
});

const setupFormResponse = (name) => {
  HgnFormResponses.findOne.mockReturnValue(
    makeQuery({
      _id: new mongoose.Types.ObjectId(),
      userInfo: {
        name,
        email: 'form@example.com',
      },
    }),
  );
};

describe('userSkillsProfileController displayName fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  test('uses questionnaire name when no UserProfile exists', async () => {
    const UserProfile = {
      findById: jest
        .fn()
        .mockReturnValueOnce(makeQuery(undefined))
        .mockResolvedValueOnce(undefined),
    };

    setupFormResponse('Form Person');

    const controller = userSkillsProfileController(UserProfile);
    const req = makeRequest();
    const res = makeResponse();
    const next = jest.fn();

    await controller.getUserSkillsProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].name.displayName).toBe('Form Person');
    expect(next).not.toHaveBeenCalled();
  });

  test('uses real UserProfile name when a UserProfile exists', async () => {
    const UserProfile = {
      findById: jest
        .fn()
        .mockReturnValueOnce(
          makeQuery({
            _id: USER_ID,
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            isActive: true,
            teams: [],
            jobTitle: [],
            contactSettings: {
              isEmailPublic: true,
              isPhonePublic: false,
            },
          }),
        )
        .mockResolvedValueOnce({}),
    };

    setupFormResponse('Questionnaire Person');

    const controller = userSkillsProfileController(UserProfile);
    const req = makeRequest();
    const res = makeResponse();
    const next = jest.fn();

    await controller.getUserSkillsProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].name.displayName).toBe('Jane Doe');
    expect(next).not.toHaveBeenCalled();
  });
});
