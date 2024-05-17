const rolePresetsController = require('./rolePresetsController');
const {
  mockReq,
  mockRes,
  assertResMock,
  // mongoHelper: { dbConnect, dbDisconnect },
} = require('../test');
const Preset = require('../models/rolePreset');
const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');

jest.mock('../models/role');
jest.mock('../models/userProfile');

const makeSut = () => {
  const { createNewPreset } = rolePresetsController(Preset);

  return { createNewPreset };
};

// const flushPromises = async () => new Promise(setImmediate);

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

  describe('createPresetsByRole method', () => {
    test("Ensure createPresetsByRole returns 403 if user doesn't have permissions for putRole", async () => {
      const { createNewPreset } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));
      const response = await createNewPreset(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putRole');

      assertResMock(403, 'You are not authorized to make changes to roles.', response, mockRes);
    });
  });
});
