const RoleModel = require('../models/role');
const UserProfileModel = require('../models/userProfile');
const { mockReq: mockRequest, mockRes: mockResponse, assertResMock: assertResponseMock } = require('../test');

jest.mock('../models/role');
jest.mock('../models/userProfile');
jest.mock('../utilities/permissions');
jest.mock('../utilities/nodeCache');

const cacheManager = require('../utilities/nodeCache');
const authHelper = require('../utilities/permissions');
const rolesControllerFactory = require('./rolesController');

const resolvePromises = () => new Promise(setImmediate);

const mockAuthCheck = (isAuthorized) =>
  jest.spyOn(authHelper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(isAuthorized));

const setupCacheMock = (method, value) => {
  const cacheService = {
    getCache: jest.fn(),
    removeCache: jest.fn(),
    hasCache: jest.fn(),
    setCache: jest.fn(),
  };

  const methodSpy = jest.spyOn(cacheService, method).mockReturnValue(value);
  cacheManager.mockReturnValue(cacheService);

  return { methodSpy, cacheService };
};

const initializeRolesController = () => {
  const controllerInstance = rolesControllerFactory(RoleModel);
  return {
    getRoles: controllerInstance.getAllRoles,
    createRole: controllerInstance.createNewRole,
    getRole: controllerInstance.getRoleById,
    updateRole: controllerInstance.updateRoleById,
    deleteRole: controllerInstance.deleteRoleById,
  };
};

describe('Roles Management System', () => {
  let rolesAPI;

  beforeEach(() => {
    rolesAPI = initializeRolesController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Operations', () => {
    it('creates new role with valid data', async () => {
      mockAuthCheck(true);
      mockRequest.body = { 
        roleName: 'SuperAdmin', 
        permissions: ['create', 'update'],
        permissionsBackEnd: ['system']
      };

      const expectedRole = {
        roleName: 'SuperAdmin',
        permissions: ['create', 'update'],
        permissionsBackEnd: ['system']
      };

      const saveFn = jest.fn().mockResolvedValue(expectedRole);
      jest.spyOn(RoleModel.prototype, 'save').mockImplementationOnce(saveFn);
      
      const response = await rolesAPI.createRole(mockRequest, mockResponse);
      
      expect(saveFn).toHaveBeenCalled();
      assertResponseMock(201, expectedRole, response, mockResponse);
    });

    it('blocks unauthorized role creation', async () => {
      const authCheckSpy = mockAuthCheck(false);
      
      const response = await rolesAPI.createRole(mockRequest, mockResponse);
      
      expect(authCheckSpy).toHaveBeenCalledWith(mockRequest.body.requestor, 'postRole');
      assertResponseMock(403, 'You are not authorized to create new roles.', response, mockResponse);
    });

    it('validates required fields for role creation', async () => {
      mockAuthCheck(true);
      mockRequest.body = {};
      
      const response = await rolesAPI.createRole(mockRequest, mockResponse);
      
      assertResponseMock(
        400,
        { error: 'roleName and permissions are mandatory fields.' },
        response,
        mockResponse,
      );
    });

    it('handles database errors during creation', async () => {
      mockAuthCheck(true);
      mockRequest.body = { roleName: 'SuperAdmin', permissions: ['create'] };
      const dbError = new Error('Database connection failed');
      const saveFn = jest.fn().mockRejectedValue(dbError);
      jest.spyOn(RoleModel.prototype, 'save').mockImplementationOnce(saveFn);
      
      const response = await rolesAPI.createRole(mockRequest, mockResponse);
      await resolvePromises();
      
      assertResponseMock(500, { err: dbError }, response, mockResponse);
    });
  });

  describe('Read Operations', () => {
    it('retrieves all roles successfully', async () => {
      const rolesList = [{ roleName: 'SuperAdmin', permission: 'fullAccess' }];
      jest.spyOn(RoleModel, 'find').mockResolvedValue(rolesList);
      
      const response = await rolesAPI.getRoles(mockRequest, mockResponse);
      
      assertResponseMock(200, rolesList, response, mockResponse);
    });

    it('handles database errors when fetching roles', async () => {
      const dbError = new Error('Database connection error');
      jest.spyOn(RoleModel, 'find').mockRejectedValue(dbError);
      
      const response = await rolesAPI.getRoles(mockRequest, mockResponse);
      await resolvePromises();
      
      assertResponseMock(404, { error: dbError }, response, mockResponse);
    });

    it('fetches single role by ID successfully', async () => {
      const targetRole = { roleName: 'SuperAdmin', permissions: ['fullAccess'] };
      jest.spyOn(RoleModel, 'findById').mockResolvedValue(targetRole);
      
      const response = await rolesAPI.getRole(mockRequest, mockResponse);
      
      assertResponseMock(200, targetRole, response, mockResponse);
    });

    it('handles errors when fetching single role', async () => {
      const lookupError = new Error('Role not found');
      jest.spyOn(RoleModel, 'findById').mockRejectedValue(lookupError);
      
      const response = await rolesAPI.getRole(mockRequest, mockResponse);
      await resolvePromises();
      
      assertResponseMock(404, { error: lookupError }, response, mockResponse);
    });
  });

  describe('Update Operations', () => {
    it('blocks unauthorized role updates', async () => {
      const authCheckSpy = mockAuthCheck(false);
      
      const response = await rolesAPI.updateRole(mockRequest, mockResponse);
      
      expect(authCheckSpy).toHaveBeenCalledWith(mockRequest.body.requestor, 'putRole');
      assertResponseMock(403, 'You are not authorized to make changes to roles.', response, mockResponse);
    });

    it('requires permissions field for updates', async () => {
      mockAuthCheck(true);
      mockRequest.body = {};
      
      const response = await rolesAPI.updateRole(mockRequest, mockResponse);
      
      assertResponseMock(400, { error: 'Permissions is a mandatory field' }, response, mockResponse);
    });

    it('validates role existence before update', async () => {
      mockAuthCheck(true);
      mockRequest.body = { roleId: '5a7e21f00317bc1538def4b7', permissions: ['read'] };
      jest.spyOn(RoleModel, 'findById').mockImplementation((roleId, callback) => callback(null, null));
      
      const response = await rolesAPI.updateRole(mockRequest, mockResponse);
      
      assertResponseMock(400, 'No valid records found', response, mockResponse);
    });

    it('updates role with valid data', async () => {
      mockAuthCheck(true);
      mockRequest.body = { permissions: ['read', 'write'] };
      
      const updatedRole = {
        roleName: 'SuperAdmin',
        permissions: ['read', 'write'],
        save: jest.fn().mockResolvedValue({ roleName: 'SuperAdmin', permissions: ['read', 'write'] })
      };
      
      jest.spyOn(RoleModel, 'findById').mockImplementation((roleId, callback) => callback(null, updatedRole));
      jest.spyOn(RoleModel.prototype, 'save').mockImplementationOnce(updatedRole.save);
      
      const response = await rolesAPI.updateRole(mockRequest, mockResponse);
      
      expect(updatedRole.save).toHaveBeenCalled();
      assertResponseMock(201, { roleName: 'SuperAdmin', permissions: ['read', 'write'] }, response, mockResponse);
    });

    it('handles database errors during update', async () => {
      mockAuthCheck(true);
      mockRequest.body = { permissions: ['read'] };
      const dbError = new Error('Update failed');
      const roleData = { save: jest.fn().mockRejectedValue(dbError) };
      
      jest.spyOn(RoleModel, 'findById').mockImplementation((roleId, callback) => callback(null, roleData));
      jest.spyOn(RoleModel.prototype, 'save').mockImplementationOnce(roleData.save);
      
      const response = await rolesAPI.updateRole(mockRequest, mockResponse);
      await resolvePromises();
      
      assertResponseMock(400, dbError, response, mockResponse);
    });
  });

  describe('Delete Operations', () => {
    it('blocks unauthorized role deletion', async () => {
      const authCheckSpy = mockAuthCheck(false);
      
      const response = await rolesAPI.deleteRole(mockRequest, mockResponse);
      
      expect(authCheckSpy).toHaveBeenCalledWith(mockRequest.body.requestor, 'deleteRole');
      assertResponseMock(403, 'You are not authorized to delete roles.', response, mockResponse);
    });
  });
}); 