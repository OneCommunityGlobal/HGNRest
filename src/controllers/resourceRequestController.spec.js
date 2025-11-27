const resourceRequestController = require('./resourceRequestController');
const mongoose = require('mongoose');

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const { hasPermission } = require('../utilities/permissions');

const MockResourceRequest = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  prototype: {
    save: jest.fn(),
  },
};

const MockUserProfile = {
  findById: jest.fn(),
};

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('resourceRequestController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = resourceRequestController(MockResourceRequest, MockUserProfile);
  });

  test('should create a resource request successfully', async () => {
    const req = {
      body: {
        requestor: { _id: '123', role: 'Educator' },
        request_title: 'Need markers',
        request_details: 'Blue and black markers',
      },
    };
    const res = mockResponse();

    MockUserProfile.findById.mockResolvedValueOnce({ _id: '123' }); // educator exists

    const savedRequest = { _id: 'abc123', educator_id: '123' };
    MockResourceRequest.prototype.save = jest.fn().mockResolvedValue(savedRequest);

    MockResourceRequest.findById = jest.fn().mockResolvedValue(savedRequest);

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalled();
  });

  test('should return 400 if missing required title/details', async () => {
    const req = {
      body: {
        requestor: { _id: '123', role: 'Educator' },
      },
    };
    const res = mockResponse();

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should fetch educator requests', async () => {
    hasPermission.mockResolvedValue(true);

    const req = {
      body: { requestor: { _id: '123', role: 'Educator' } },
      query: {},
    };
    const res = mockResponse();

    MockResourceRequest.find.mockReturnValueOnce({
      sort: () => ({
        populate: () => ['req1', 'req2'],
      }),
    });

    await controller.getEducatorResourceRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(['req1', 'req2']);
  });

  test('should fetch PM resource requests', async () => {
    hasPermission.mockResolvedValue(true);

    const req = {
      body: { requestor: { _id: 'pm1', role: 'Program Manager' } },
      query: {},
    };
    const res = mockResponse();

    MockResourceRequest.find.mockReturnValueOnce({
      sort: () => ({
        populate: () => ({
          populate: () => ['reqA', 'reqB'],
        }),
      }),
    });

    await controller.getPMResourceRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(['reqA', 'reqB']);
  });

  test('should update request status', async () => {
    hasPermission.mockResolvedValue(true);

    const req = {
      params: { id: 'req1' },
      body: { status: 'approved', requestor: { _id: 'pm1', role: 'Program Manager' } },
    };
    const res = mockResponse();

    const existing = {
      _id: 'req1',
      status: 'pending',
      save: jest.fn().mockResolvedValue({ _id: 'req1', status: 'approved' }),
    };

    MockResourceRequest.findById.mockResolvedValue(existing);

    MockResourceRequest.findById.mockResolvedValueOnce(existing).mockResolvedValueOnce({
      _id: 'req1',
      status: 'approved',
      educator_id: '123',
      pm_id: 'pm1',
    });

    await controller.updatePMResourceRequestStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  test('should return 404 if PM updates missing request', async () => {
    hasPermission.mockResolvedValue(true);

    const req = {
      params: { id: 'missing' },
      body: { status: 'approved', requestor: { _id: 'pm1' } },
    };
    const res = mockResponse();

    MockResourceRequest.findById.mockResolvedValue(null);

    await controller.updatePMResourceRequestStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
