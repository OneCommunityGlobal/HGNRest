const resourceRequestController = require('./resourceRequestController');
const mongoose = require('mongoose');

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const { hasPermission } = require('../utilities/permissions');

function createPopulateChain(result) {
  const chain = {
    populate: jest.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  chain.populate.mockReturnValue(chain);
  return chain;
}

function MockResourceRequest(data) {
  Object.assign(this, data);
}
MockResourceRequest.prototype.save = jest.fn();
MockResourceRequest.findById = jest.fn();
MockResourceRequest.find = jest.fn();

const MockUserProfile = {
  findById: jest.fn(),
};

function mockRequest(body = {}, params = {}, query = {}) {
  return {
    body,
    params,
    query,
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
      requestor: { requestorId: '123', role: 'Educator' },
      request_title: 'Need supplies',
      request_details: 'Markers and charts',
    });

    const res = mockResponse();

    MockResourceRequest.prototype.save.mockResolvedValue({
      _id: 'req1',
      educator_id: '123',
    });

    MockResourceRequest.findById.mockReturnValue(
      createPopulateChain({
        _id: 'req1',
        educator_id: '123',
      }),
    );

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('educator cannot set status manually', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({
      requestor: { requestorId: '123', role: 'Educator' },
      request_title: 'Need laptop',
      request_details: 'Macbook',
      status: 'approved',
    });

    const res = mockResponse();

    MockResourceRequest.prototype.save.mockResolvedValue({
      _id: 'req2',
      status: 'pending',
    });

    MockResourceRequest.findById.mockReturnValue(
      createPopulateChain({
        _id: 'req2',
        status: 'pending',
      }),
    );

    await controller.createResourceRequest(req, res);

    expect(MockResourceRequest.prototype.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('PM fetches all requests', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({ requestor: { requestorId: 'pm1', role: 'Program Manager' } });

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

    const req = mockRequest({ requestor: { requestorId: '123', role: 'Educator' } });

    const res = mockResponse();

    await controller.getPMResourceRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('PM updates status successfully', async () => {
    hasPermission.mockResolvedValue(true);

    const validId = new mongoose.Types.ObjectId().toHexString();

    const req = mockRequest(
      {
        requestor: { requestorId: 'pm1', role: 'Program Manager' },
        status: 'approved',
      },
      { id: validId },
    );

    const res = mockResponse();

    const existing = {
      _id: validId,
      status: 'pending',
      save: jest.fn().mockResolvedValue({ _id: validId, status: 'approved' }),
    };

    MockResourceRequest.findById.mockReturnValueOnce(Promise.resolve(existing)).mockReturnValueOnce(
      createPopulateChain({
        _id: validId,
        status: 'approved',
      }),
    );

    await controller.updatePMResourceRequestStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('unauthenticated request returns 401', async () => {
    const req = mockRequest({});
    const res = mockResponse();

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('non-educator cannot create request', async () => {
    hasPermission.mockResolvedValue(false);

    const req = mockRequest({
      requestor: { requestorId: '456', role: 'Volunteer' },
      request_title: 'Test',
      request_details: 'Test details',
    });

    const res = mockResponse();

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('missing request_title returns 400', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({
      requestor: { requestorId: '123', role: 'Educator' },
      request_details: 'Some details',
    });

    const res = mockResponse();

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('invalid ObjectId returns 400 on PM update', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest(
      {
        requestor: { requestorId: 'pm1', role: 'Program Manager' },
        status: 'approved',
      },
      { id: 'invalid-id' },
    );

    const res = mockResponse();

    await controller.updatePMResourceRequestStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
