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
  const { createNewPreset, getPresetsByRole, updatePresetById, deletePresetById } =
    rolePresetsController(Preset);
  return { createNewPreset, getPresetsByRole, updatePresetById, deletePresetById };
};

const flushPromises = () => new Promise(setImmediate);

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
    test("Ensure createNewPresets returns 403 if user doesn't have permissions for putRole", async () => {
      const { createNewPreset } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await createNewPreset(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putRole');

      assertResMock(
        403,
        {
          error: 'You are not authorized to make changes to roles.',
        },
        response,
        mockRes,
      );
    });
    test('Ensure createNewPresetsreturns 400 if missing roleName', async () => {
      const { createNewPreset } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        body: {
          ...mockReq.body,
          presetName: 'testPreset',
          premissions: ['testPremissions'],
        },
      };
      const response = await createNewPreset(newMockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(
        400,
        {
          error: 'roleName, presetName, and permissions are mandatory fields.',
        },
        response,
        mockRes,
      );
    });
    test('Ensure createNewPresets returns 400 if missing presetName', async () => {
      const { createNewPreset } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        body: {
          ...mockReq.body,
          roleName: 'testRole',
          premissions: ['testPremissions'],
        },
      };
      const response = await createNewPreset(newMockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(
        400,
        {
          error: 'roleName, presetName, and permissions are mandatory fields.',
        },
        response,
        mockRes,
      );
    });
    test('Ensure createNewPresets returns 400 if missing permissions', async () => {
      const { createNewPreset } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        body: {
          ...mockReq.body,
          roleName: 'testRole',
          presetName: 'testPreset',
        },
      };
      const response = await createNewPreset(newMockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(
        400,
        {
          error: 'roleName, presetName, and permissions are mandatory fields.',
        },
        response,
        mockRes,
      );
    });
    test('Ensure createNewPresets returns 400 if any error when saving new preset', async () => {
      const { createNewPreset } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          roleName: 'some roleName',
          presetName: 'some Preset',
          permissions: ['test', 'write'],
        },
      };
      jest
        .spyOn(Preset.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when saving')));

      const response = await createNewPreset(newMockReq, mockRes);
      await flushPromises();

      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(400, new Error('Error when saving'), response, mockRes);
    });
    test('Ensure createNewPresets returns 201 if saving new preset successfully', async () => {
      const { createNewPreset } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const data = {
        roleName: 'testRoleName',
        presetName: 'testPresetName',
        premissions: ['somePremissions'],
      };
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          roleName: 'some roleName',
          presetName: 'some Preset',
          permissions: ['test', 'write'],
        },
      };
      jest.spyOn(Preset.prototype, 'save').mockImplementationOnce(() => Promise.resolve(data));

      const response = await createNewPreset(newMockReq, mockRes);
      await flushPromises();

      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(
        201,
        {
          newPreset: data,
          message: 'New preset created',
        },
        response,
        mockRes,
      );
    });
  });
  describe('getPresetsByRole method', () => {
    test("Ensure getPresetsByRole returns 403 if user doesn't have permissions for putRole", async () => {
      const { getPresetsByRole } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await getPresetsByRole(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putRole');

      assertResMock(
        403,
        {
          error: 'You are not authorized to make changes to roles.',
        },
        response,
        mockRes,
      );
    });
    test('Ensure getPresetsByRole returns 400 if error in finding roleName', async () => {
      const { getPresetsByRole } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          roleName: 'test roleName',
        },
      };
      jest
        .spyOn(Preset, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding')));
      const response = await getPresetsByRole(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(400, new Error('Error when finding'), response, mockRes);
    });
    test('Ensure getPresetsByRole returns 200 if finding roleName successfully', async () => {
      const { getPresetsByRole } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          roleName: 'test roleName',
        },
      };
      const data = {
        roleName: 'test roleName',
        presetName: 'test Presetname2',
        permissions: ['read', 'add'],
      };
      jest.spyOn(Preset, 'find').mockImplementationOnce(() => Promise.resolve(data));
      const response = await getPresetsByRole(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(200, data, response, mockRes);
    });
  });
  describe('updatePresetById method', () => {
    test("Ensure updatePresetById returns 403 if user doesn't have permissions for putRole", async () => {
      const { updatePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await updatePresetById(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putRole');

      assertResMock(
        403,
        {
          error: 'You are not authorized to make changes to roles.',
        },
        response,
        mockRes,
      );
    });
    test('Ensure updatePresetById returns 404 if error in finding by id', async () => {
      const { updatePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          presetId: '7237f9af9820a0134ca79c5d',
        },
      };
      jest
        .spyOn(Preset, 'findById')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding by id')));
      const response = await updatePresetById(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(404, new Error('Error when finding by id'), response, mockRes);
    });
    test('Ensure updatePresetById returns 400 if error in saving results', async () => {
      const { updatePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          presetId: '7237f9af9820a0134ca79c5d',
        },
        body: {
          ...mockReq.body,
          roleName: 'abc RoleName',
          presetName: 'abd Preset',
          permissions: ['readABC', 'writeABC'],
        },
      };
      const findObj = { save: () => {} };
      const findByIdSpy = jest.spyOn(Preset, 'findById').mockResolvedValue(findObj);
      jest.spyOn(findObj, 'save').mockRejectedValue(new Error('Error when saving results'));
      const response = await updatePresetById(newMockReq, mockRes);

      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      expect(findByIdSpy).toHaveBeenCalledWith(newMockReq.params.presetId);
      assertResMock(400, new Error('Error when saving results'), response, mockRes);
    });
    test('Ensure updatePresetById returns 200 if updatePreset by id successfully', async () => {
      const { updatePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const data = {
        roleName: 'abc RoleName',
        presetName: 'abd Preset',
        permissions: ['readABC', 'writeABC'],
      };
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          presetId: '7237f9af9820a0134ca79c5d',
        },
        body: {
          ...mockReq.body,
          roleName: 'abc RoleName',
          presetName: 'abd Preset',
          permissions: ['readABC', 'writeABC'],
        },
      };
      const findObj = { save: () => {} };
      const findByIdSpy = jest.spyOn(Preset, 'findById').mockResolvedValue(findObj);
      jest.spyOn(findObj, 'save').mockResolvedValueOnce(data);
      const response = await updatePresetById(newMockReq, mockRes);

      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      expect(findByIdSpy).toHaveBeenCalledWith(newMockReq.params.presetId);
      assertResMock(200, data, response, mockRes);
    });
  });
  describe('deletePresetById method', () => {
    test("Ensure deletePresetById returns 403 if user doesn't have permissions for putRole", async () => {
      const { deletePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(false));

      const response = await deletePresetById(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putRole');

      assertResMock(
        403,
        {
          error: 'You are not authorized to make changes to roles.',
        },
        response,
        mockRes,
      );
    });
    test('Ensure deletePresetById returns 404 if error in finding by id', async () => {
      const { deletePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          presetId: '7237f9af9820a0134ca79c5d',
        },
      };
      jest
        .spyOn(Preset, 'findById')
        .mockImplementationOnce(() => Promise.reject(new Error('Error when finding by id')));
      const response = await deletePresetById(newMockReq, mockRes);
      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      assertResMock(404, new Error('Error when finding by id'), response, mockRes);
    });
    test('Ensure deletePresetById returns 400 if error in removing', async () => {
      const { deletePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          presetId: '7237f9af9820a0134ca79c5d',
        },
        body: {
          ...mockReq.body,
          roleName: 'abc RoleName',
          presetName: 'abd Preset',
          permissions: ['readABC', 'writeABC'],
        },
      };
      const removeObj = { remove: () => {} };
      const findByIdSpy = jest.spyOn(Preset, 'findById').mockResolvedValue(removeObj);
      jest.spyOn(removeObj, 'remove').mockRejectedValue(new Error('Error when removing'));
      const response = await deletePresetById(newMockReq, mockRes);

      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      expect(findByIdSpy).toHaveBeenCalledWith(newMockReq.params.presetId);
      assertResMock(400, new Error('Error when removing'), response, mockRes);
    });
    test('Ensure deletePresetById returns 200 if deleting successfully', async () => {
      const { deletePresetById } = makeSut();
      const hasPermissionSpy = jest
        .spyOn(helper, 'hasPermission')
        .mockImplementationOnce(() => Promise.resolve(true));
      const newMockReq = {
        ...mockReq,
        params: {
          ...mockReq.params,
          presetId: '7237f9af9820a0134ca79c5d',
        },
        body: {
          ...mockReq.body,
          roleName: 'abc RoleName',
          presetName: 'abd Preset',
          permissions: ['readABC', 'writeABC'],
        },
      };
      const removeObj = { remove: () => {} };
      const findByIdSpy = jest.spyOn(Preset, 'findById').mockResolvedValue(removeObj);
      jest.spyOn(removeObj, 'remove').mockImplementationOnce(() => Promise.resolve(true));
      const response = await deletePresetById(newMockReq, mockRes);

      await flushPromises();
      expect(hasPermissionSpy).toHaveBeenCalledWith(newMockReq.body.requestor, 'putRole');

      expect(findByIdSpy).toHaveBeenCalledWith(newMockReq.params.presetId);
      assertResMock(
        200,
        {
          message: 'Deleted preset',
        },
        response,
        mockRes,
      );
    });
  });
});
