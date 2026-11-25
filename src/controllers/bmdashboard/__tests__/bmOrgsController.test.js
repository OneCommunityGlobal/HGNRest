jest.mock('../../../models/bmdashboard/orgLocation', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

const Organizations = require('../../../models/bmdashboard/orgLocation');
const bmOrgsController = require('../bmOrgsController');

describe('BM Organizations Controller', () => {
  let controller;
  let req;
  let res;

  const createMockOrg = (overrides = {}) => ({
    orgId: 'PRJ001',
    name: 'Test Project',
    description: 'Test description',
    status: 'active',
    country: 'India',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    location: {
      type: 'Point',
      coordinates: [80.2707, 13.0827],
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const mockQuery = (method, result) => {
    Organizations[method].mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(result),
      }),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    controller = bmOrgsController();

    req = {
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ------------------------------------------
  // GET ALL ORGANIZATIONS
  // ------------------------------------------

  describe('getAllOrgs', () => {
    it('should return all organizations with valid coordinates', async () => {
      const organizations = [
        createMockOrg(),
        createMockOrg({
          orgId: 'PRJ002',
          name: 'Second Project',
          location: {
            coordinates: [0, 0],
          },
        }),
        createMockOrg({
          orgId: 'PRJ003',
          location: null,
        }),
      ];

      mockQuery('find', organizations);

      await controller.getAllOrgs(req, res);

      expect(Organizations.find).toHaveBeenCalledWith({});

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: expect.arrayContaining([
          expect.objectContaining({
            orgId: 'PRJ001',
            latitude: 13.0827,
            longitude: 80.2707,
          }),
          expect.objectContaining({
            orgId: 'PRJ002',
            latitude: 0,
            longitude: 0,
          }),
        ]),
      });
    });

    it('should apply start and end date filters', async () => {
      req.query = {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      mockQuery('find', []);

      await controller.getAllOrgs(req, res);

      expect(Organizations.find).toHaveBeenCalledWith({
        startDate: {
          $gte: new Date('2026-01-01'),
          $lte: new Date('2026-12-31'),
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should apply only the start date filter', async () => {
      req.query.startDate = '2026-01-01';

      mockQuery('find', []);

      await controller.getAllOrgs(req, res);

      expect(Organizations.find).toHaveBeenCalledWith({
        startDate: {
          $gte: new Date('2026-01-01'),
        },
      });
    });

    it('should apply only the end date filter', async () => {
      req.query.endDate = '2026-12-31';

      mockQuery('find', []);

      await controller.getAllOrgs(req, res);

      expect(Organizations.find).toHaveBeenCalledWith({
        startDate: {
          $lte: new Date('2026-12-31'),
        },
      });
    });

    it('should return 500 when database query fails', async () => {
      Organizations.find.mockImplementation(() => {
        throw new Error('Database failure');
      });

      await controller.getAllOrgs(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database failure',
      });
    });
  });

  // ------------------------------------------
  // GET ORGANIZATION BY ID
  // ------------------------------------------

  describe('getOrgById', () => {
    it('should return an organization by ID', async () => {
      req.params.id = 'PRJ001';

      const org = createMockOrg();

      mockQuery('findOne', org);

      await controller.getOrgById(req, res);

      expect(Organizations.findOne).toHaveBeenCalledWith({
        orgId: 'PRJ001',
      });

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          orgId: 'PRJ001',
          latitude: 13.0827,
          longitude: 80.2707,
          country: 'India',
        }),
      });
    });

    it('should return 404 when organization does not exist', async () => {
      req.params.id = 'INVALID';

      mockQuery('findOne', null);

      await controller.getOrgById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Organization not found',
      });
    });

    it('should return 500 when database query fails', async () => {
      req.params.id = 'PRJ001';

      Organizations.findOne.mockImplementation(() => {
        throw new Error('Database failure');
      });

      await controller.getOrgById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error Database failure',
      });
    });
  });

  // ------------------------------------------
  // CREATE ORGANIZATION
  // ------------------------------------------

  describe('createOrg', () => {
    const validBody = {
      orgId: 'PRJ001',
      name: 'Test Project',
      description: 'Test description',
      status: 'active',
      latitude: 13.0827,
      longitude: 80.2707,
      country: 'India',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    it('should return 400 when required fields are missing', async () => {
      req.body = {
        orgId: 'PRJ001',
        name: 'Test Project',
      };

      await controller.createOrg(req, res);

      expect(Organizations.findOne).not.toHaveBeenCalled();
      expect(Organizations.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'All organization fields are required.',
      });
    });

    it('should return 409 when organization ID already exists', async () => {
      req.body = validBody;

      Organizations.findOne.mockResolvedValue(createMockOrg());

      await controller.createOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Organization ID already exists.',
      });

      expect(Organizations.create).not.toHaveBeenCalled();
    });

    it('should create an organization successfully', async () => {
      req.body = validBody;

      const createdOrg = createMockOrg();

      Organizations.findOne.mockResolvedValue(null);
      Organizations.create.mockResolvedValue(createdOrg);

      await controller.createOrg(req, res);

      expect(Organizations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'PRJ001',
          name: 'Test Project',
          location: {
            type: 'Point',
            coordinates: [80.2707, 13.0827],
          },
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Organization created successfully.',
        data: createdOrg,
      });
    });

    it('should return 400 when creation fails', async () => {
      req.body = validBody;

      Organizations.findOne.mockResolvedValue(null);
      Organizations.create.mockRejectedValue(new Error('Creation failed'));

      await controller.createOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Creation failed',
      });
    });
  });

  // ------------------------------------------
  // UPDATE ORGANIZATION
  // ------------------------------------------

  describe('updateOrg', () => {
    it('should return 404 when organization does not exist', async () => {
      req.params.id = 'INVALID';

      Organizations.findOne.mockResolvedValue(null);

      await controller.updateOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Organization not found.',
      });
    });

    it('should update organization fields successfully', async () => {
      req.params.id = 'PRJ001';

      req.body = {
        name: 'Updated Project',
        description: 'Updated description',
        status: 'completed',
        country: 'Japan',
        startDate: '2026-02-01',
        endDate: '2026-11-30',
      };

      const org = createMockOrg();

      Organizations.findOne.mockResolvedValue(org);

      await controller.updateOrg(req, res);

      expect(org.name).toBe('Updated Project');
      expect(org.description).toBe('Updated description');
      expect(org.status).toBe('completed');
      expect(org.country).toBe('Japan');

      expect(org.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update both latitude and longitude', async () => {
      req.params.id = 'PRJ001';

      req.body = {
        latitude: 19.076,
        longitude: 72.8777,
      };

      const org = createMockOrg();

      Organizations.findOne.mockResolvedValue(org);

      await controller.updateOrg(req, res);

      expect(org.location).toEqual({
        type: 'Point',
        coordinates: [72.8777, 19.076],
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update only latitude and preserve longitude', async () => {
      req.params.id = 'PRJ001';

      req.body = {
        latitude: 19.076,
      };

      const org = createMockOrg();

      Organizations.findOne.mockResolvedValue(org);

      await controller.updateOrg(req, res);

      expect(org.location.coordinates).toEqual([80.2707, 19.076]);
    });

    it('should update only longitude and preserve latitude', async () => {
      req.params.id = 'PRJ001';

      req.body = {
        longitude: 72.8777,
      };

      const org = createMockOrg();

      Organizations.findOne.mockResolvedValue(org);

      await controller.updateOrg(req, res);

      expect(org.location.coordinates).toEqual([72.8777, 13.0827]);
    });

    it('should return 400 when updating fails', async () => {
      req.params.id = 'PRJ001';

      Organizations.findOne.mockRejectedValue(new Error('Update failed'));

      await controller.updateOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Update failed',
      });
    });
  });

  // ------------------------------------------
  // DELETE ORGANIZATION
  // ------------------------------------------

  describe('deleteOrg', () => {
    it('should delete an organization successfully', async () => {
      req.params.id = 'PRJ001';

      Organizations.findOneAndDelete.mockResolvedValue(createMockOrg());

      await controller.deleteOrg(req, res);

      expect(Organizations.findOneAndDelete).toHaveBeenCalledWith({
        orgId: 'PRJ001',
      });

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Organization deleted successfully.',
      });
    });

    it('should return 404 when organization does not exist', async () => {
      req.params.id = 'INVALID';

      Organizations.findOneAndDelete.mockResolvedValue(null);

      await controller.deleteOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Organization not found.',
      });
    });

    it('should return 500 when deletion fails', async () => {
      req.params.id = 'PRJ001';

      Organizations.findOneAndDelete.mockRejectedValue(new Error('Delete failed'));

      await controller.deleteOrg(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delete failed',
      });
    });
  });
});
