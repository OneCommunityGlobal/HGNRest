// test.todo('Fix ownerMessage router tests so it can run in the CICD pipeline');
const request = require('supertest');
const { app } = require('../app');
const { jwtPayload } = require('../test');
const {
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections },
} = require('../test');
const OwnerMessage = require('../models/ownerMessage');
const Role = require('../models/role');

const agent = request.agent(app);
let adminUser;
let adminToken;
beforeAll(async () => {
  await dbConnect();
  adminUser = await createUser();
  adminToken = jwtPayload(adminUser);
});

afterAll(async () => {
  await dbDisconnect();
});
afterEach(async () => {
  await dbClearCollections('ownerMessage');
  await dbClearCollections('rolesMergedPermissions');
});

describe('Owner Message Router Integration Tests', () => {
  test('GET /ownerMessage should return 200 and the owner message', async () => {
    const ownerMessage = new OwnerMessage({
      message: 'Test Message',
      standardMessage: 'Standard Test Message',
    });
    await ownerMessage.save();
    const res = await agent.get('/api/ownerMessage').set('Authorization', adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.body.ownerMessage).toHaveProperty('message', 'Test Message');
    expect(res.body.ownerMessage).toHaveProperty('standardMessage', 'Standard Test Message');
  });

  test('GET /ownerMessage should return empty message if none exist', async () => {
    const res = await agent.get('/api/ownerMessage').set('Authorization', adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.body.ownerMessage).toHaveProperty('message', '');
    expect(res.body.ownerMessage).toHaveProperty('standardMessage', '');
  });

  test('PUT /ownerMessage should update the owner message when authorized', async () => {
    const role = new Role({ roleName: adminUser.role, permissions: ['editHeaderMessage'] });
    await role.save();
    const ownerMessage = new OwnerMessage({
      message: 'Initial Message',
      standardMessage: 'Initial Standard Message',
    });
    await ownerMessage.save();
    const res = await request(app)
      .put('/api/ownerMessage')
      .set('Authorization', adminToken)
      .send({
        requestor: {
          requestorId: adminUser._id,
          role: adminUser.role,
        },
        isStandard: false,
        newMessage: 'Updated Test Message',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.ownerMessage).toHaveProperty('message', 'Updated Test Message');
  });

  test('PUT /ownerMessage should return 403 when unauthorized', async () => {
    const role = new Role({ roleName: adminUser.role, permissions: [] });
    await role.save();
    const ownerMessage = new OwnerMessage({
      message: 'Initial Message',
      standardMessage: 'Initial Standard Message',
    });
    await ownerMessage.save();
    const res = await request(app)
      .put('/api/ownerMessage')
      .set('Authorization', adminToken)
      .send({
        requestor: {
          requestorId: adminUser._id,
          role: adminUser.role,
        },
        isStandard: false,
        newMessage: 'Updated Test Message',
      });
    expect(res.statusCode).toBe(403);
  });

  test('DELETE /ownerMessage should delete the owner message when authorized', async () => {
    const role = new Role({ roleName: adminUser.role, permissions: ['editHeaderMessage'] });
    await role.save();
    const ownerMessage = new OwnerMessage({
      message: 'Message to be deleted',
      standardMessage: 'Standard Message',
    });
    await ownerMessage.save();
    const res = await request(app)
      .delete('/api/ownerMessage')
      .set('Authorization', adminToken)
      .send({
        requestor: {
          requestorId: adminUser._id,
          role: adminUser.role,
        },
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.ownerMessage).toHaveProperty('message', '');
  });

  test('DELETE /ownerMessage should return 403 when unauthorized', async () => {
    const role = new Role({ roleName: adminUser.role, permissions: [] });
    await role.save();
    const ownerMessage = new OwnerMessage({
      message: 'Message to be deleted',
      standardMessage: 'Standard Message',
    });
    await ownerMessage.save();
    const res = await request(app)
      .delete('/api/ownerMessage')
      .set('Authorization', adminToken)
      .send({
        requestor: {
          requestorId: adminUser._id,
          role: adminUser.role,
        },
      });
    expect(res.statusCode).toBe(403);
  });
});
