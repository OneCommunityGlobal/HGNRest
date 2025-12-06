const resourceRequestController = require('./resourceRequestController');
const mongoose = require('mongoose');

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const { hasPermission } = require('../utilities/permissions');

const MockResourceRequest = {
  findById: jest.fn(),
  find: jest.fn(),
  prototype: { save: jest.fn() },
};

const MockUserProfile = {
  findById: jest.fn(),
};

function mockRequest(body = {}, params = {}, query = {}) {
  return {
    body,
    params,
    query,
    requestor: body.requestor,
  };
}

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

  test('educator creates request successfully', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({
      requestor: { _id: '123', role: 'Educator' },
      request_title: 'Need supplies',
      request_details: 'Markers and charts',
    });

    const res = mockResponse();

    MockResourceRequest.prototype.save = jest.fn().mockResolvedValue({
      _id: 'req1',
      educator_id: '123',
    });

    MockResourceRequest.findById = jest.fn().mockResolvedValue({
      _id: 'req1',
      educator_id: '123',
    });

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('educator cannot set status manually', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({
      requestor: { _id: '123', role: 'Educator' },
      request_title: 'Need laptop',
      request_details: 'Macbook',
      status: 'approved',
    });

    const res = mockResponse();

    MockResourceRequest.prototype.save = jest.fn().mockResolvedValue({
      _id: 'req2',
      status: 'pending',
    });

    MockResourceRequest.findById = jest.fn().mockResolvedValue({
      _id: 'req2',
      status: 'pending',
    });

    await controller.createResourceRequest(req, res);

    expect(MockResourceRequest.prototype.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('PM fetches all requests', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({ requestor: { _id: 'pm1', role: 'Program Manager' } });

    const res = mockResponse();

    MockResourceRequest.find.mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => ['reqA', 'reqB'],
            }),
          }),
        }),
      }),
    });

    await controller.getPMResourceRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('educator cannot access PM endpoint', async () => {
    hasPermission.mockResolvedValue(false);

    const req = mockRequest({ requestor: { _id: '123', role: 'Educator' } });

    const res = mockResponse();

    await controller.getPMResourceRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('PM updates status successfully', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest(
      {
        requestor: { _id: 'pm1', role: 'Program Manager' },
        status: 'approved',
      },
      { id: 'req1' }
    );

    const res = mockResponse();

    const existing = {
      _id: 'req1',
      status: 'pending',
      save: jest.fn().mockResolvedValue({ _id: 'req1', status: 'approved' }),
    };

    MockResourceRequest.findById.mockResolvedValueOnce(existing);
    MockResourceRequest.findById.mockResolvedValueOnce({
      _id: 'req1',
      status: 'approved',
    });

    await controller.updatePMResourceRequestStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
