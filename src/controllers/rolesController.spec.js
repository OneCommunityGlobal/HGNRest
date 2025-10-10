jest.mock('../models/role');
jest.mock('../models/userProfile');
jest.mock('../utilities/permissions');

const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');
const { mockReq, mockRes, assertResMock } = require('../test');

const rolesController = require('./rolesController');

const flushPromises = () => new Promise(setImmediate);
const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const makeSut = () => rolesController(Role);

describe('rolesController module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllRoles function', () => {
    test('Should return 200 and roles on success', async () => {
      const { getAllRoles } = makeSut();
      const mockRoles = [{ roleName: 'role', permission: 'permissionTest' }];
      jest.spyOn(Role, 'find').mockResolvedValue(mockRoles);
      const response = await getAllRoles(mockReq, mockRes);
      assertResMock(200, mockRoles, response, mockRes);
    });

    test('Should return 404 on error', async () => {
      const { getAllRoles } = makeSut();
      const error = new Error('Test Error');

      jest.spyOn(Role, 'find').mockRejectedValue(error);
      const response = await getAllRoles(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, { error }, response, mockRes);
    });
  });

  describe('createNewRole function', () => {
    test('Should return 403 if user lacks permission', async () => {
      const { createNewRole } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await createNewRole(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postRole');
      assertResMock(403, 'You are not authorized to create new roles.', response, mockRes);
    });

    test('Should return 400 if mandatory fields are missing', async () => {
      const { createNewRole } = makeSut();
      mockReq.body = {};
      mockHasPermission(true);
      const response = await createNewRole(mockReq, mockRes);
      assertResMock(
        400,
        { error: 'roleName and permissions are mandatory fields.' },
        response,
        mockRes,
      );
    });

    test('Should return 201 and the new role on success', async () => {
      const { createNewRole } = makeSut();
      mockHasPermission(true);
      mockReq.body = { roleName: 'newRole', permissions: ['read'], permissionsBackEnd: ['write'] };
      const mockRole = {
        save: jest.fn().mockResolvedValue({
          roleName: 'newRole',
          permissions: ['read'],
          permissionsBackEnd: ['write'],
        }),
      };
      jest.spyOn(Role.prototype, 'save').mockImplementationOnce(mockRole.save);
      const response = await createNewRole(mockReq, mockRes);
      expect(mockRole.save).toHaveBeenCalled();
      assertResMock(
        201,
        { roleName: 'newRole', permissions: ['read'], permissionsBackEnd: ['write'] },
        response,
        mockRes,
      );
    });
    test('Should return 500 on role save error', async () => {
      const { createNewRole } = makeSut();
      mockHasPermission(true);
      mockReq.body = { roleName: 'newRole', permissions: ['read'], permissionsBackEnd: ['write'] };
      const mockRole = { save: jest.fn().mockRejectedValue(new Error('Save Error')) };
      jest.spyOn(Role.prototype, 'save').mockImplementationOnce(mockRole.save);
      const response = await createNewRole(mockReq, mockRes);
      await flushPromises();
      assertResMock(500, { err: new Error('Save Error') }, response, mockRes);
    });
  });

  describe('getRoleById function', () => {
    test('Should return 200 and the role on success', async () => {
      const { getRoleById } = makeSut();
      const mockRole = { roleName: 'role', permissions: ['read'] };
      jest.spyOn(Role, 'findById').mockResolvedValue(mockRole);
      const response = await getRoleById(mockReq, mockRes);
      assertResMock(200, mockRole, response, mockRes);
    });

    test('Should return 404 on error', async () => {
      const { getRoleById } = makeSut();
      const error = new Error('Test Error');
      jest.spyOn(Role, 'findById').mockRejectedValue(error);
      const response = await getRoleById(mockReq, mockRes);
      await flushPromises();
      assertResMock(404, { error }, response, mockRes);
    });
  });

  describe('updateRoleById function', () => {
    test('Should return 403 if user lacks permission', async () => {
      const { updateRoleById } = makeSut();
      const hasPermissionSpy = mockHasPermission(false);
      const response = await updateRoleById(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putRole');
      assertResMock(403, 'You are not authorized to make changes to roles.', response, mockRes);
    });

    test('Should return 400 if mandatory fields are missing', async () => {
      const { updateRoleById } = makeSut();
      mockReq.body = {};
      mockHasPermission(true);
      const response = await updateRoleById(mockReq, mockRes);
      assertResMock(400, { error: 'Permissions is a mandatory field' }, response, mockRes);
    });

    test('Should return 400 if no valid records are found', async () => {
      const { updateRoleById } = makeSut();
      mockHasPermission(true);
      mockReq.body = { roleId: '5a7e21f00317bc1538def4b7', permissions: ['read'] };
      jest.spyOn(Role, 'findById').mockImplementation((roleId, callback) => callback(null, null));
      const response = await updateRoleById(mockReq, mockRes);
      assertResMock(400, 'No valid records found', response, mockRes);
    });

    test('Should return 201 and the updated role on success', async () => {
      const { updateRoleById } = makeSut();
      mockHasPermission(true);
      mockReq.body = { permissions: ['read'] };
      const mockRole = {
        save: jest.fn().mockResolvedValue({ roleName: 'role', permissions: ['read'] }),
      };
      jest
        .spyOn(Role, 'findById')
        .mockImplementation((roleId, callback) => callback(null, mockRole));
      jest.spyOn(Role.prototype, 'save').mockImplementationOnce(mockRole.save);
      const response = await updateRoleById(mockReq, mockRes);
      expect(mockRole.save).toHaveBeenCalled();
      assertResMock(201, { roleName: 'role', permissions: ['read'] }, response, mockRes);
    });

    test('Should return 500 on role save error', async () => {
      const { updateRoleById } = makeSut();
      mockHasPermission(true);
      mockReq.body = { permissions: ['read'] };
      const mockRole = { save: jest.fn().mockRejectedValue(new Error('Save Error')) };
      jest
        .spyOn(Role, 'findById')
        .mockImplementation((roleId, callback) => callback(null, mockRole));
      jest.spyOn(Role.prototype, 'save').mockImplementationOnce(mockRole.save);
      const response = await updateRoleById(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, new Error('Save Error'), response, mockRes);
    });
  });

  describe('deleteRoleById function', () => {
    test('Should return 403 if user lacks permission', async () => {
      const { deleteRoleById } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);
      const response = await deleteRoleById(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteRole');
      assertResMock(403, 'You are not authorized to delete roles.', response, mockRes);
    });

    test('Should return 404 if role does not exist', async () => {
      mockHasPermission(true);

      jest.spyOn(Role, 'findById').mockResolvedValue(null); // No role found

      const { deleteRoleById } = makeSut();
      const response = await deleteRoleById(mockReq, mockRes);

      assertResMock(404, { error: 'Role not found' }, response, mockRes);
    });

    describe('deleteRoleById function', () => {
      test('Should return 403 if user lacks permission', async () => {
        const { deleteRoleById } = makeSut();

        const hasPermissionSpy = mockHasPermission(false);
        const response = await deleteRoleById(mockReq, mockRes);

        expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteRole');
        assertResMock(403, 'You are not authorized to delete roles.', response, mockRes);
      });

      test('Should return 404 if role does not exist', async () => {
        mockHasPermission(true);

        jest.spyOn(Role, 'findById').mockResolvedValue(null); // No role found

        const { deleteRoleById } = makeSut();
        const response = await deleteRoleById(mockReq, mockRes);

        assertResMock(404, { error: 'Role not found' }, response, mockRes);
      });

      test('Should return 200 and update users after deleting role', async () => {
        mockHasPermission(true);

        // --- Setup mock request ---
        mockReq.params = { roleId: '12345' };

        // --- Mock role returned by Role.findById ---
        const mockRole = { _id: '12345', roleName: 'role' };

        // Spy on Role methods
        jest.spyOn(Role, 'findById').mockResolvedValue(mockRole);
        jest.spyOn(Role, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

        // Spy on UserProfile.updateMany
        const updateManySpy = jest
          .spyOn(UserProfile, 'updateMany')
          .mockResolvedValue({ modifiedCount: 2 });

        const { deleteRoleById } = makeSut();
        const response = await deleteRoleById(mockReq, mockRes);

        // --- Debugging log ---
        console.log('UpdateMany mock calls:', updateManySpy.mock.calls);

        // Verify updateMany was called exactly once with correct args
        expect(updateManySpy).toHaveBeenCalledTimes(1);
        expect(updateManySpy).toHaveBeenCalledWith(
          { role: 'role' },
          { $set: { role: 'Volunteer' } },
        );

        // Verify role deletion
        expect(Role.deleteOne).toHaveBeenCalledWith({ _id: '12345' });

        // Verify response
        assertResMock(
          200,
          { message: 'Deleted role "role" and reassigned affected users to Volunteer' },
          response,
          mockRes,
        );
      });
    });
  });
});
