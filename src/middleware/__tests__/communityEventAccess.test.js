jest.mock('../../config', () => ({ JWT_SECRET: 'isolated-community-event-test-secret' }));
jest.mock('../../controllers/eventController', () => {
  const handlers = [
    'getEventTypes',
    'getEventLocations',
    'getEvents',
    'createEvent',
    'getEventById',
    'registerForEvent',
    'unregisterFromEvent',
    'joinWaitlist',
    'leaveWaitlist',
    'leaveEvent',
  ];
  return Object.fromEntries(
    handlers.map((handler) => [handler, jest.fn((_req, res) => res.sendStatus(200))]),
  );
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const controllers = require('../../controllers/eventController');
const eventRouter = require('../../routes/eventRouter');

const self = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const endpoints = [
  ['get', '/events/types'],
  ['get', '/events/locations'],
  ['get', '/events'],
  ['post', '/events'],
  ['get', '/events/event-id'],
  ['post', '/events/event-id/register'],
  ['delete', `/events/event-id/register/${self}`],
  ['post', '/events/event-id/waitlist'],
  ['delete', '/events/event-id/waitlist'],
  ['post', '/events/event-id/leave'],
];

function token(overrides = {}) {
  return jwt.sign(
    {
      userid: self,
      role: 'Volunteer',
      expiryTimestamp: new Date(Date.now() + 60000).toISOString(),
      access: { canAccessBMPortal: true },
      ...overrides,
    },
    config.JWT_SECRET,
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api', eventRouter);
  instance.get('/api/unrelated', (_req, res) => res.sendStatus(200));
  return instance;
}

beforeEach(() => jest.clearAllMocks());

describe('event API secondary login', () => {
  test.each(endpoints)(
    'denies main-only tokens on %s %s before the controller runs',
    async (method, route) => {
      const response = await request(app())
        [method](`/api${route}`)
        .set('Authorization', token({ access: { canAccessBMPortal: false } }))
        .send({ userId: self });
      expect(response.status).toBe(403);
      Object.values(controllers).forEach((controller) => expect(controller).not.toHaveBeenCalled());
    },
  );

  test.each(endpoints)('preserves secondary-verified requests on %s %s', async (method, route) => {
    const response = await request(app())
      [method](`/api${route}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ userId: self });
    expect(response.status).toBe(200);
    expect(
      Object.values(controllers).filter((controller) => controller.mock.calls.length),
    ).toHaveLength(1);
  });

  test.each([undefined, null, {}, { canAccessBMPortal: 'true' }, { canAccessBMPortal: 1 }])(
    'fails closed for unsupported access claims: %p',
    async (access) => {
      const response = await request(app())
        .get('/api/events')
        .set('Authorization', token({ access }));
      expect(response.status).toBe(403);
      expect(controllers.getEvents).not.toHaveBeenCalled();
    },
  );

  test.each([
    ['missing', null],
    ['invalid signature', jwt.sign({ userid: self }, 'wrong-secret')],
    ['expired timestamp', token({ expiryTimestamp: new Date(0).toISOString() })],
    ['missing role', token({ role: undefined })],
    ['missing identity', token({ userid: undefined })],
  ])('rejects %s authentication', async (_label, authorization) => {
    let call = request(app()).get('/api/events');
    if (authorization) call = call.set('Authorization', authorization);
    const response = await call;
    expect(response.status).toBe(401);
    expect(controllers.getEvents).not.toHaveBeenCalled();
  });

  test('does not put a secondary-login gate on unrelated /api routes', async () => {
    const response = await request(app())
      .get('/api/unrelated')
      .set('Authorization', token({ access: undefined }));
    expect(response.status).toBe(200);
  });
});

describe('self-service registration ownership', () => {
  test.each([other, undefined, null, [self], { userId: self }])(
    'rejects a registration for a foreign or malformed identity: %p',
    async (userId) => {
      const response = await request(app())
        .post('/api/events/event-id/register')
        .set('Authorization', token())
        .send({ userId });
      expect(response.status).toBe(403);
      expect(controllers.registerForEvent).not.toHaveBeenCalled();
    },
  );

  test('ignores client-supplied Owner/requestor and secondary-access claims', async () => {
    const response = await request(app())
      .post('/api/events/event-id/register')
      .set('Authorization', token())
      .send({
        userId: other,
        requestor: { role: 'Owner', requestorId: other },
        communityPortalUserId: other,
        access: { canAccessBMPortal: true },
      });
    expect(response.status).toBe(403);
    expect(controllers.registerForEvent).not.toHaveBeenCalled();
  });

  test('uses the cancellation URL identity even when the body contains the caller ID', async () => {
    const response = await request(app())
      .delete(`/api/events/event-id/register/${other}`)
      .set('Authorization', token())
      .send({ userId: self });
    expect(response.status).toBe(403);
    expect(controllers.unregisterFromEvent).not.toHaveBeenCalled();
  });

  test('does not invent an Owner override for the self-service endpoint', async () => {
    const response = await request(app())
      .post('/api/events/event-id/register')
      .set('Authorization', token({ role: 'Owner' }))
      .send({ userId: other });
    expect(response.status).toBe(403);
    expect(controllers.registerForEvent).not.toHaveBeenCalled();
  });
});
