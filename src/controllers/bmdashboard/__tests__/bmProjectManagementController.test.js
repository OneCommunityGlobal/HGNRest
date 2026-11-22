const mockCreate = jest.fn();
const mockFindById = jest.fn();

jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  create: mockCreate,
  findById: mockFindById,
}));

const bmMProjectController = require('../bmProjectController');

const validPayload = {
  name: 'Earthbag Village',
  city: 'San Diego',
  country: 'United States',
  latitude: 32.7157,
  longitude: -117.1611,
  status: 'Active',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
};

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('BM project create and edit controller', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = bmMProjectController();
  });

  test.each(['Owner', 'Administrator'])('allows %s to create a project', async (role) => {
    const created = { _id: 'project-1', ...validPayload };
    mockCreate.mockResolvedValue(created);
    const req = { user: { role, requestorId: '507f1f77bcf86cd799439011' }, body: validPayload };
    const res = makeResponse();

    await controller.createProject(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: validPayload.name,
        status: 'active',
        region: 'North America',
        isActive: true,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  test('rejects a non-owner/admin create request', async () => {
    const req = { user: { role: 'Volunteer' }, body: validPayload };
    const res = makeResponse();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('rejects invalid coordinates and date order', async () => {
    const req = {
      user: { role: 'Owner' },
      body: { ...validPayload, latitude: 100, endDate: '2025-01-01' },
    };
    const res = makeResponse();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'latitude' }),
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('updates a project with normalized status and active state', async () => {
    const project = {
      set: jest.fn(),
      save: jest.fn().mockResolvedValue({ _id: 'project-1', status: 'completed' }),
    };
    mockFindById.mockResolvedValue(project);
    const req = {
      user: { role: 'Administrator' },
      params: { projectId: 'project-1' },
      body: { ...validPayload, status: 'Completed' },
    };
    const res = makeResponse();

    await controller.updateProject(req, res);

    expect(project.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', isActive: false }),
    );
    expect(project.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
