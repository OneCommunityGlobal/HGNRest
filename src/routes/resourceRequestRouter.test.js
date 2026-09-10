const express = require('express');
const request = require('supertest');
const resourceRequestRoutes = require('./resourceRequestRouter');

const mockController = {
  createResourceRequest: jest.fn((req, res) => res.status(201).json({ ok: true })),
  getEducatorResourceRequests: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getPMResourceRequests: jest.fn((req, res) => res.status(200).json({ ok: true })),
  updatePMResourceRequestStatus: jest.fn((req, res) => res.status(200).json({ ok: true })),
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', resourceRequestRoutes({}, {}, mockController));
  return app;
}

const VALID_ID = '507f1f77bcf86cd799439011';

describe('resourceRequestRouter', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/educator/resource-requests', () => {
    test('routes to createResourceRequest when body is valid', async () => {
      const res = await request(app).post('/api/educator/resource-requests').send({
        request_title: 'New chairs',
        request_details: 'We need 10 new chairs for the classroom.',
      });

      expect(res.status).toBe(201);
      expect(mockController.createResourceRequest).toHaveBeenCalledTimes(1);
    });

    test('returns 400 when request_title is missing', async () => {
      const res = await request(app).post('/api/educator/resource-requests').send({
        request_details: 'Details only.',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'request_title', message: 'Request title is required' }),
        ]),
      );
      expect(mockController.createResourceRequest).not.toHaveBeenCalled();
    });

    test('returns 400 when request_title is blank/whitespace', async () => {
      const res = await request(app).post('/api/educator/resource-requests').send({
        request_title: '   ',
        request_details: 'Details here.',
      });

      expect(res.status).toBe(400);
      expect(mockController.createResourceRequest).not.toHaveBeenCalled();
    });

    test('returns 400 when request_title exceeds 200 characters', async () => {
      const res = await request(app)
        .post('/api/educator/resource-requests')
        .send({
          request_title: 'a'.repeat(201),
          request_details: 'Valid details.',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'request_title',
            message: 'Request title must be at most 200 characters',
          }),
        ]),
      );
      expect(mockController.createResourceRequest).not.toHaveBeenCalled();
    });

    test('returns 400 when request_details is missing', async () => {
      const res = await request(app).post('/api/educator/resource-requests').send({
        request_title: 'Valid title',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'request_details',
            message: 'Request details are required',
          }),
        ]),
      );
      expect(mockController.createResourceRequest).not.toHaveBeenCalled();
    });

    test('returns 400 when request_details exceeds 2000 characters', async () => {
      const res = await request(app)
        .post('/api/educator/resource-requests')
        .send({
          request_title: 'Valid title',
          request_details: 'a'.repeat(2001),
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'request_details',
            message: 'Request details must be at most 2000 characters',
          }),
        ]),
      );
      expect(mockController.createResourceRequest).not.toHaveBeenCalled();
    });

    test('returns 400 with both field errors when title and details are both missing', async () => {
      const res = await request(app).post('/api/educator/resource-requests').send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveLength(2);
      expect(mockController.createResourceRequest).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/educator/resource-requests', () => {
    test('routes to getEducatorResourceRequests with no query params', async () => {
      const res = await request(app).get('/api/educator/resource-requests');

      expect(res.status).toBe(200);
      expect(mockController.getEducatorResourceRequests).toHaveBeenCalledTimes(1);
    });

    test.each(['pending', 'approved', 'denied'])('accepts status=%s', async (status) => {
      const res = await request(app).get('/api/educator/resource-requests').query({ status });

      expect(res.status).toBe(200);
      expect(mockController.getEducatorResourceRequests).toHaveBeenCalledTimes(1);
    });

    test('returns 400 when status is invalid', async () => {
      const res = await request(app)
        .get('/api/educator/resource-requests')
        .query({ status: 'bogus' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'status', message: 'Invalid status filter' }),
        ]),
      );
      expect(mockController.getEducatorResourceRequests).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/pm/resource-requests', () => {
    test('routes to getPMResourceRequests with no query params', async () => {
      const res = await request(app).get('/api/pm/resource-requests');

      expect(res.status).toBe(200);
      expect(mockController.getPMResourceRequests).toHaveBeenCalledTimes(1);
    });

    test('routes to getPMResourceRequests with all valid query params', async () => {
      const res = await request(app).get('/api/pm/resource-requests').query({
        status: 'approved',
        educator_id: VALID_ID,
        limit: 10,
        page: 2,
      });

      expect(res.status).toBe(200);
      expect(mockController.getPMResourceRequests).toHaveBeenCalledTimes(1);
    });

    test('returns 400 when status is invalid', async () => {
      const res = await request(app).get('/api/pm/resource-requests').query({ status: 'bogus' });

      expect(res.status).toBe(400);
      expect(mockController.getPMResourceRequests).not.toHaveBeenCalled();
    });

    test('returns 400 when educator_id is not a valid Mongo ID', async () => {
      const res = await request(app)
        .get('/api/pm/resource-requests')
        .query({ educator_id: 'not-an-id' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'educator_id', message: 'Invalid educator ID' }),
        ]),
      );
      expect(mockController.getPMResourceRequests).not.toHaveBeenCalled();
    });

    test('returns 400 when limit is below 1', async () => {
      const res = await request(app).get('/api/pm/resource-requests').query({ limit: 0 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'limit', message: 'Limit must be between 1 and 100' }),
        ]),
      );
      expect(mockController.getPMResourceRequests).not.toHaveBeenCalled();
    });

    test('returns 400 when limit is above 100', async () => {
      const res = await request(app).get('/api/pm/resource-requests').query({ limit: 101 });

      expect(res.status).toBe(400);
      expect(mockController.getPMResourceRequests).not.toHaveBeenCalled();
    });

    test('returns 400 when page is not a positive integer', async () => {
      const res = await request(app).get('/api/pm/resource-requests').query({ page: 0 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'page', message: 'Page must be a positive integer' }),
        ]),
      );
      expect(mockController.getPMResourceRequests).not.toHaveBeenCalled();
    });

    test('returns 400 with multiple errors when several query params are invalid', async () => {
      const res = await request(app).get('/api/pm/resource-requests').query({
        status: 'bogus',
        educator_id: 'not-an-id',
        limit: -1,
        page: -1,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(4);
      expect(mockController.getPMResourceRequests).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/pm/resource-requests/:id', () => {
    test('routes to updatePMResourceRequestStatus when params and body are valid', async () => {
      const res = await request(app)
        .put(`/api/pm/resource-requests/${VALID_ID}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(mockController.updatePMResourceRequestStatus).toHaveBeenCalledTimes(1);
    });

    test('passes the id through req.params', async () => {
      await request(app).put(`/api/pm/resource-requests/${VALID_ID}`).send({ status: 'denied' });

      const req = mockController.updatePMResourceRequestStatus.mock.calls[0][0];
      expect(req.params.id).toBe(VALID_ID);
    });

    test('returns 400 when id is not a valid Mongo ID', async () => {
      const res = await request(app)
        .put('/api/pm/resource-requests/not-an-id')
        .send({ status: 'approved' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'id', message: 'Invalid request ID' }),
        ]),
      );
      expect(mockController.updatePMResourceRequestStatus).not.toHaveBeenCalled();
    });

    test('returns 400 when status is missing', async () => {
      const res = await request(app).put(`/api/pm/resource-requests/${VALID_ID}`).send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'status', message: 'Invalid status value' }),
        ]),
      );
      expect(mockController.updatePMResourceRequestStatus).not.toHaveBeenCalled();
    });

    test('returns 400 when status is not an allowed value', async () => {
      const res = await request(app)
        .put(`/api/pm/resource-requests/${VALID_ID}`)
        .send({ status: 'archived' });

      expect(res.status).toBe(400);
      expect(mockController.updatePMResourceRequestStatus).not.toHaveBeenCalled();
    });

    test('returns 400 with both errors when id and status are both invalid', async () => {
      const res = await request(app)
        .put('/api/pm/resource-requests/not-an-id')
        .send({ status: 'archived' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveLength(2);
      expect(mockController.updatePMResourceRequestStatus).not.toHaveBeenCalled();
    });
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/unknown/route/here');

    expect(res.status).toBe(404);
  });
});
