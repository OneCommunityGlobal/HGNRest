const resourceRequestController = require('./resourceRequestController');

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

const EDUCATOR_ID = 'aabbccddeeff001122334455';
const PM_ID = '112233445566778899001122';
const REQUEST_ID = 'aabbccddeeff00112233a1b2';

describe('resourceRequestController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = resourceRequestController(MockResourceRequest, MockUserProfile);
  });

  test('educator creates request successfully', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({
      requestor: { requestorId: EDUCATOR_ID, role: 'Educator' },
      request_title: 'Need supplies',
      request_details: 'Markers and charts',
    });

    const res = mockResponse();

    MockResourceRequest.prototype.save.mockResolvedValue({
      _id: REQUEST_ID,
      educator_id: EDUCATOR_ID,
    });

    MockResourceRequest.findById.mockReturnValue(
      createPopulateChain({
        _id: REQUEST_ID,
        educator_id: EDUCATOR_ID,
      }),
    );

    await controller.createResourceRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('educator cannot set status manually', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({
      requestor: { requestorId: EDUCATOR_ID, role: 'Educator' },
      request_title: 'Need laptop',
      request_details: 'Macbook',
      status: 'approved',
    });

    const res = mockResponse();

    MockResourceRequest.prototype.save.mockResolvedValue({
      _id: REQUEST_ID,
      status: 'pending',
    });

    MockResourceRequest.findById.mockReturnValue(
      createPopulateChain({
        _id: REQUEST_ID,
        status: 'pending',
      }),
    );

    await controller.createResourceRequest(req, res);

    expect(MockResourceRequest.prototype.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('PM fetches all requests', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest({ requestor: { requestorId: PM_ID, role: 'Program Manager' } });

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

    const req = mockRequest({ requestor: { requestorId: EDUCATOR_ID, role: 'Educator' } });

    const res = mockResponse();

    await controller.getPMResourceRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('PM updates status successfully', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest(
      {
        requestor: { requestorId: PM_ID, role: 'Program Manager' },
        status: 'approved',
      },
      { id: REQUEST_ID },
    );

    const res = mockResponse();

    const existing = {
      _id: REQUEST_ID,
      status: 'pending',
      save: jest.fn().mockResolvedValue({ _id: REQUEST_ID, status: 'approved' }),
    };

    MockResourceRequest.findById.mockReturnValueOnce(Promise.resolve(existing)).mockReturnValueOnce(
      createPopulateChain({
        _id: REQUEST_ID,
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
      requestor: { requestorId: EDUCATOR_ID, role: 'Volunteer' },
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
      requestor: { requestorId: EDUCATOR_ID, role: 'Educator' },
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
        requestor: { requestorId: PM_ID, role: 'Program Manager' },
        status: 'approved',
      },
      { id: 'invalid-id' },
    );

    const res = mockResponse();

    await controller.updatePMResourceRequestStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getEducatorResourceRequests filters by status', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest(
      { requestor: { requestorId: EDUCATOR_ID, role: 'Educator' } },
      {},
      { status: 'approved' },
    );

    const res = mockResponse();

    MockResourceRequest.find.mockReturnValue({
      sort: () => ({
        populate: () => createPopulateChain([]),
      }),
    });

    await controller.getEducatorResourceRequests(req, res);

    expect(MockResourceRequest.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getPMResourceRequests filters by educator_id', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest(
      { requestor: { requestorId: PM_ID, role: 'Program Manager' } },
      {},
      { educator_id: EDUCATOR_ID },
    );

    const res = mockResponse();

    MockResourceRequest.find.mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => [],
            }),
          }),
        }),
      }),
    });

    await controller.getPMResourceRequests(req, res);

    expect(MockResourceRequest.find).toHaveBeenCalledWith(
      expect.objectContaining({
        educator_id: EDUCATOR_ID,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('invalid status query param is ignored', async () => {
    hasPermission.mockResolvedValue(true);

    const req = mockRequest(
      { requestor: { requestorId: EDUCATOR_ID, role: 'Educator' } },
      {},
      { status: 'malicious-value' },
    );

    const res = mockResponse();

    MockResourceRequest.find.mockReturnValue({
      sort: () => ({
        populate: () => createPopulateChain([]),
      }),
    });

    await controller.getEducatorResourceRequests(req, res);

    expect(MockResourceRequest.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: expect.anything() }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
