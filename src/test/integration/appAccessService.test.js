const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ApplicationAccess = require('../../models/applicationAccess');
const {
  upsertAppAccess,
  revokeAppAccess,
  getAppCredentials,
  getAppAccess,
} = require('../../services/automation/appAccessService');

describe('application access service persistence', () => {
  let mongoServer;
  const userId = 'app-access-test-user';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  beforeEach(async () => {
    await ApplicationAccess.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  const stored = () => ApplicationAccess.findOne({ userId }).lean();

  test('persists a new invitation with the real schema and retrieval methods', async () => {
    const before = Date.now();
    await upsertAppAccess(userId, 'dropbox', 'invited', 'id:test-folder', 'HGN');

    const record = await stored();
    expect(record.apps).toHaveLength(1);
    expect(record.apps[0]).toMatchObject({
      app: 'dropbox',
      status: 'invited',
      credentials: 'id:test-folder',
      teamFolderKey: 'HGN',
      revokedOn: null,
      failedReason: null,
    });
    expect(record.apps[0].invitedOn.getTime()).toBeGreaterThanOrEqual(before);
    expect(record.apps[0].invitedOn.getTime()).toBeLessThanOrEqual(Date.now());
    await expect(getAppCredentials(userId, 'dropbox')).resolves.toBe('id:test-folder');
    await expect(getAppAccess(userId, 'dropbox')).resolves.toEqual({
      status: 'invited',
      credentials: 'id:test-folder',
      teamFolderKey: 'HGN',
      invitedOn: record.apps[0].invitedOn,
      revokedOn: null,
      failedReason: null,
    });
  });

  test('updates the existing application in place and preserves another app and user', async () => {
    await upsertAppAccess(userId, 'github', 'invited', 'test-login');
    await upsertAppAccess(userId, 'dropbox', 'invited', 'id:old', 'ADMIN');
    await upsertAppAccess('other-user', 'dropbox', 'invited', 'id:other', 'ADMIN');
    const original = await stored();
    const other = await ApplicationAccess.findOne({ userId: 'other-user' }).lean();

    await upsertAppAccess(userId, 'dropbox', 'invited', 'id:new', 'HGN');

    const record = await stored();
    expect(record._id).toEqual(original._id);
    expect(await ApplicationAccess.countDocuments({ userId })).toBe(1);
    expect(record.apps).toHaveLength(2);
    expect(record.apps[0]).toEqual(original.apps[0]);
    expect(record.apps[1]).toMatchObject({
      app: 'dropbox',
      credentials: 'id:new',
      teamFolderKey: 'HGN',
    });
    expect(await ApplicationAccess.findOne({ userId: 'other-user' }).lean()).toEqual(other);
  });

  test('persists revocation without deleting invitation history or other applications', async () => {
    await upsertAppAccess(userId, 'dropbox', 'invited', 'id:test-folder', 'HGN');
    await upsertAppAccess(userId, 'github', 'invited', 'test-login');
    const original = await stored();
    const before = Date.now();

    await revokeAppAccess(userId, 'dropbox');

    const record = await stored();
    expect(record.apps).toHaveLength(2);
    expect(record.apps[0]).toMatchObject({
      ...original.apps[0],
      status: 'revoked',
      revokedOn: expect.any(Date),
    });
    expect(record.apps[0].revokedOn.getTime()).toBeGreaterThanOrEqual(before);
    expect(record.apps[1]).toEqual(original.apps[1]);
    expect((await getAppAccess(userId, 'dropbox')).status).toBe('revoked');
  });

  test.each(['revoked', 'failed'])(
    'persists re-invitation from %s with new credentials and cleared old state',
    async (status) => {
      await ApplicationAccess.create({
        userId,
        apps: [
          {
            app: 'dropbox',
            status,
            credentials: 'id:old',
            teamFolderKey: 'ADMIN',
            invitedOn: new Date('2025-01-01'),
            revokedOn: new Date('2025-02-01'),
            failedReason: 'Old error',
          },
        ],
      });
      const before = Date.now();

      await upsertAppAccess(userId, 'dropbox', 'invited', 'id:new', 'HGN');

      const record = await stored();
      expect(record.apps).toHaveLength(1);
      expect(record.apps[0]).toMatchObject({
        app: 'dropbox',
        status: 'invited',
        credentials: 'id:new',
        teamFolderKey: 'HGN',
        revokedOn: null,
        failedReason: null,
      });
      expect(record.apps[0].invitedOn.getTime()).toBeGreaterThanOrEqual(before);
    },
  );

  test('persists the null folder-key default on creation and update', async () => {
    await upsertAppAccess(userId, 'github', 'invited', 'test-login');
    expect((await stored()).apps[0].teamFolderKey).toBeNull();

    await upsertAppAccess(userId, 'github', 'invited', 'test-login', 'TEST');
    await upsertAppAccess(userId, 'github', 'invited', 'test-login');
    expect((await stored()).apps[0].teamFolderKey).toBeNull();
  });

  test('rejects unknown statuses on creation without inserting a record', async () => {
    await expect(upsertAppAccess(userId, 'dropbox', 'unknown', 'id:test')).rejects.toMatchObject({
      name: 'ValidationError',
    });
    expect(await ApplicationAccess.countDocuments({ userId })).toBe(0);
  });

  test('does not persist a rejected status update over an existing invitation', async () => {
    await upsertAppAccess(userId, 'dropbox', 'invited', 'id:original', 'HGN');
    const original = await stored();

    await expect(
      upsertAppAccess(userId, 'dropbox', 'unknown', 'id:changed', 'ADMIN'),
    ).rejects.toMatchObject({ name: 'ValidationError' });

    expect(await stored()).toEqual(original);
  });

  test('reports missing records and applications without creating or changing them', async () => {
    await expect(revokeAppAccess(userId, 'dropbox')).rejects.toThrow(
      'No application access record',
    );
    await expect(getAppCredentials(userId, 'dropbox')).rejects.toThrow('credentials not found');
    await expect(getAppAccess(userId, 'dropbox')).rejects.toThrow('access not found');
    expect(await ApplicationAccess.countDocuments({ userId })).toBe(0);

    await upsertAppAccess(userId, 'github', 'invited', 'test-login');
    const original = await stored();
    await expect(revokeAppAccess(userId, 'dropbox')).rejects.toThrow(
      'folder information not found',
    );
    await expect(getAppCredentials(userId, 'dropbox')).rejects.toThrow('credentials not found');
    await expect(getAppAccess(userId, 'dropbox')).rejects.toThrow('access not found');
    expect(await stored()).toEqual(original);
  });

  test('keeps an invitation without credentials unchanged when revocation is rejected', async () => {
    await upsertAppAccess(userId, 'dropbox', 'failed', null, 'HGN');
    const original = await stored();

    await expect(revokeAppAccess(userId, 'dropbox')).rejects.toThrow(
      'folder information not found',
    );
    await expect(getAppCredentials(userId, 'dropbox')).rejects.toThrow('credentials not found');
    expect(await stored()).toEqual(original);
    expect((await getAppAccess(userId, 'dropbox')).status).toBe('failed');
  });
});
