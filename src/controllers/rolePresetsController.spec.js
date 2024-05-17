const rolePresetsController = require('./rolePresetsController');
const { mockReq, mockRes, assertResMock } = require('../test');
const Preset = require('../models/rolePreset');
const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');

// Mock the models
jest.mock('../models/role');
jest.mock('../models/userProfile');

const makeSut = () => {
  const { createNewPreset } = rolePresetsController(Preset);
  return { createNewPreset };
};

describe('rolePresets Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Role.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ permissions: ['someOtherPermission'] }),
    });
    UserProfile.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ permissions: { frontPermissions: [] } }),
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNewPreset method', () => {
    test.only("Ensure getPresetsByRole returns 403 if user doesn't have permissions for putRole", async () => {
      const { createNewPreset } = makeSut();
      // Set up the spy before calling the function
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await createNewPreset(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putRole');

      assertResMock(403, 'You are not authorized to make changes to roles.', response, mockRes);
    });
  });
});
