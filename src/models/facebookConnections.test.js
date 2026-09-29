const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const FacebookConnection = require('./facebookConnections');

const PAGE_TOKEN = 'model-page-token-secret';
const USER_TOKEN = 'model-user-token-secret';

describe('FacebookConnection token selection', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1' },
    });
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await FacebookConnection.init();
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await FacebookConnection.deleteMany({});
    }
  });

  afterAll(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      if (mongoServer) {
        await mongoServer.stop();
      }
    }
  });

  it('hides tokens by default and restores them only through explicit selection', async () => {
    const connection = await FacebookConnection.create({
      pageId: '10001',
      pageName: 'Token Test Page',
      pageAccessToken: PAGE_TOKEN,
      userAccessToken: USER_TOKEN,
      isActive: true,
    });

    const ordinaryResult = await FacebookConnection.findById(connection._id).lean().exec();
    expect(ordinaryResult).not.toHaveProperty('pageAccessToken');
    expect(ordinaryResult).not.toHaveProperty('userAccessToken');

    const explicitlySelected = await FacebookConnection.findById(connection._id)
      .select('+pageAccessToken +userAccessToken')
      .lean()
      .exec();
    expect(explicitlySelected.pageAccessToken).toBe(PAGE_TOKEN);
    expect(explicitlySelected.userAccessToken).toBe(USER_TOKEN);
  });

  it('preserves active/newest query semantics and exposes only the narrow page-token option', async () => {
    await FacebookConnection.create({
      pageId: '10002',
      pageName: 'Inactive Page',
      pageAccessToken: 'inactive-page-token',
      userAccessToken: 'inactive-user-token',
      isActive: false,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    await FacebookConnection.create({
      pageId: '10003',
      pageName: 'Older Active Page',
      pageAccessToken: 'older-page-token',
      userAccessToken: 'older-user-token',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await FacebookConnection.create({
      pageId: '10004',
      pageName: 'Newest Active Page',
      pageAccessToken: PAGE_TOKEN,
      userAccessToken: USER_TOKEN,
      isActive: true,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const defaultConnection = await FacebookConnection.getActiveConnection();
    expect(defaultConnection.pageId).toBe('10004');
    expect(defaultConnection.pageAccessToken).toBeUndefined();
    expect(defaultConnection.userAccessToken).toBeUndefined();
    expect(defaultConnection.toObject()).not.toHaveProperty('pageAccessToken');
    expect(defaultConnection.toObject()).not.toHaveProperty('userAccessToken');

    const pageTokenConnection = await FacebookConnection.getActiveConnection({
      includePageAccessToken: true,
    });
    expect(pageTokenConnection.pageId).toBe('10004');
    expect(pageTokenConnection.pageAccessToken).toBe(PAGE_TOKEN);
    expect(pageTokenConnection.userAccessToken).toBeUndefined();
    expect(pageTokenConnection.toObject()).not.toHaveProperty('userAccessToken');

    const unsupportedOption = await FacebookConnection.getActiveConnection({
      select: '+pageAccessToken +userAccessToken',
    });
    expect(unsupportedOption.pageAccessToken).toBeUndefined();
    expect(unsupportedOption.userAccessToken).toBeUndefined();
    expect(unsupportedOption.toObject()).not.toHaveProperty('pageAccessToken');
    expect(unsupportedOption.toObject()).not.toHaveProperty('userAccessToken');
  });
});
