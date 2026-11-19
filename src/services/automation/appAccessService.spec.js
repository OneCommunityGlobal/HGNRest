jest.mock('../../models/applicationAccess', () => {
  const model = jest.fn();
  model.findOne = jest.fn();
  return model;
});

const ApplicationAccess = require('../../models/applicationAccess');
const {
  upsertAppAccess,
  revokeAppAccess,
  getAppCredentials,
  getAppAccess,
} = require('./appAccessService');

describe('application access service', () => {
  const userId = 'test-user';
  const now = new Date('2026-11-18T18:00:00.000Z');
  let record;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    record = { userId, apps: [], save: jest.fn().mockResolvedValue(undefined) };
    ApplicationAccess.findOne.mockResolvedValue(record);
    ApplicationAccess.mockImplementation((data) => ({ ...data, save: record.save }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('creating and updating access', () => {
    test('creates and saves a new user record with the requested invitation', async () => {
      ApplicationAccess.findOne.mockResolvedValue(null);
      const result = await upsertAppAccess(userId, 'dropbox', 'invited', 'id:test-folder', 'HGN');

      expect(ApplicationAccess.findOne).toHaveBeenCalledWith({ userId });
      expect(ApplicationAccess).toHaveBeenCalledWith({ userId, apps: expect.any(Array) });
      expect(result).toMatchObject({
        userId,
        apps: [
          {
            app: 'dropbox',
            status: 'invited',
            credentials: 'id:test-folder',
            teamFolderKey: 'HGN',
            invitedOn: now,
          },
        ],
      });
      expect(result.save).toHaveBeenCalledTimes(1);
    });

    test('appends a different application without changing an existing invitation', async () => {
      const existing = {
        app: 'github',
        status: 'invited',
        credentials: 'test-github',
        invitedOn: now,
      };
      record.apps = [{ ...existing }];

      const result = await upsertAppAccess(userId, 'dropbox', 'invited', 'id:new-folder', 'ADMIN');

      expect(result).toBe(record);
      expect(record.apps).toEqual([
        existing,
        {
          app: 'dropbox',
          status: 'invited',
          credentials: 'id:new-folder',
          teamFolderKey: 'ADMIN',
          invitedOn: now,
        },
      ]);
      expect(ApplicationAccess).not.toHaveBeenCalled();
      expect(record.save).toHaveBeenCalledTimes(1);
    });

    test.each(['revoked', 'failed'])(
      'reinvites an existing %s application without duplicates and clears old failure/revocation data',
      async (status) => {
        const other = { app: 'slack', status: 'invited', credentials: 'test-slack' };
        record.apps = [
          other,
          {
            app: 'dropbox',
            status,
            credentials: 'id:old',
            teamFolderKey: 'ADMIN',
            invitedOn: new Date('2026-01-01'),
            revokedOn: new Date('2026-02-01'),
            failedReason: 'Old failure',
          },
        ];

        await upsertAppAccess(userId, 'dropbox', 'invited', 'id:new', 'HGN');

        expect(record.apps).toEqual([
          other,
          {
            app: 'dropbox',
            status: 'invited',
            credentials: 'id:new',
            teamFolderKey: 'HGN',
            invitedOn: now,
            revokedOn: null,
            failedReason: null,
          },
        ]);
        expect(record.save).toHaveBeenCalledTimes(1);
      },
    );

    test('defaults a new application team-folder key to null', async () => {
      await upsertAppAccess(userId, 'github', 'invited', 'test-login');
      expect(record.apps[0].teamFolderKey).toBeNull();
    });

    test('clears the previous folder key when an update omits it', async () => {
      record.apps = [{ app: 'dropbox', status: 'invited', teamFolderKey: 'ADMIN' }];
      await upsertAppAccess(userId, 'dropbox', 'invited', 'id:new');
      expect(record.apps[0].teamFolderKey).toBeNull();
      expect(record.apps).toHaveLength(1);
    });
  });

  describe('revocation', () => {
    test('records revocation while preserving credentials, invitation date and unrelated apps', async () => {
      const invitedOn = new Date('2026-01-01');
      const other = { app: 'github', status: 'invited', credentials: 'test-login' };
      record.apps = [
        other,
        {
          app: 'dropbox',
          status: 'invited',
          credentials: 'id:folder',
          teamFolderKey: 'HGN',
          invitedOn,
        },
      ];

      await expect(revokeAppAccess(userId, 'dropbox')).resolves.toBe(record);

      expect(record.apps).toEqual([
        other,
        {
          app: 'dropbox',
          status: 'revoked',
          credentials: 'id:folder',
          teamFolderKey: 'HGN',
          invitedOn,
          revokedOn: now,
        },
      ]);
      expect(record.save).toHaveBeenCalledTimes(1);
    });

    test('reports a missing user record', async () => {
      ApplicationAccess.findOne.mockResolvedValue(null);
      await expect(revokeAppAccess(userId, 'dropbox')).rejects.toThrow(
        `No application access record found for user ${userId}`,
      );
      expect(ApplicationAccess).not.toHaveBeenCalled();
      expect(record.save).not.toHaveBeenCalled();
    });

    test('does not revoke a different application when the requested one is absent', async () => {
      const other = { app: 'github', status: 'invited', credentials: 'test-login' };
      record.apps = [{ ...other }];
      await expect(revokeAppAccess(userId, 'dropbox')).rejects.toThrow(
        'dropbox folder information not found for this user.',
      );
      expect(record.apps).toEqual([other]);
      expect(record.save).not.toHaveBeenCalled();
    });

    test.each([undefined, null, ''])(
      'does not save a revocation with missing credentials (%p)',
      async (credentials) => {
        record.apps = [{ app: 'dropbox', status: 'invited', credentials }];
        await expect(revokeAppAccess(userId, 'dropbox')).rejects.toThrow(
          'dropbox folder information not found for this user.',
        );
        expect(record.apps[0].status).toBe('invited');
        expect(record.apps[0].revokedOn).toBeUndefined();
        expect(record.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('retrieval', () => {
    test('returns credentials for only the requested application without saving', async () => {
      record.apps = [
        { app: 'github', credentials: 'other-login' },
        { app: 'dropbox', credentials: 'id:requested-folder' },
      ];
      await expect(getAppCredentials(userId, 'dropbox')).resolves.toBe('id:requested-folder');
      expect(ApplicationAccess.findOne).toHaveBeenCalledWith({ userId });
      expect(record.save).not.toHaveBeenCalled();
    });

    test.each([undefined, null, ''])('reports absent credentials (%p)', async (credentials) => {
      record.apps = [{ app: 'dropbox', credentials }];
      await expect(getAppCredentials(userId, 'dropbox')).rejects.toThrow(
        'dropbox credentials not found for this user.',
      );
      expect(record.save).not.toHaveBeenCalled();
    });

    test.each([
      ['no user', null],
      ['no matching app', { apps: [{ app: 'github', credentials: 'other' }] }],
    ])('reports missing credentials when there is %s', async (_, result) => {
      ApplicationAccess.findOne.mockResolvedValue(result);
      await expect(getAppCredentials(userId, 'dropbox')).rejects.toThrow(
        'dropbox credentials not found for this user.',
      );
    });

    test('returns the requested access details without unrelated or internal fields', async () => {
      const details = {
        status: 'failed',
        credentials: null,
        teamFolderKey: 'HGN',
        invitedOn: now,
        revokedOn: null,
        failedReason: 'Test failure',
      };
      record.apps = [
        { app: 'github', status: 'invited', credentials: 'other-login' },
        { app: 'dropbox', ...details, internalField: 'omit' },
      ];
      await expect(getAppAccess(userId, 'dropbox')).resolves.toEqual(details);
      expect(record.save).not.toHaveBeenCalled();
    });

    test.each([
      ['no user', null],
      ['no matching app', { apps: [{ app: 'github' }] }],
    ])('reports missing access when there is %s', async (_, result) => {
      ApplicationAccess.findOne.mockResolvedValue(result);
      await expect(getAppAccess(userId, 'dropbox')).rejects.toThrow(
        'dropbox access not found for this user.',
      );
    });
  });

  describe('database errors', () => {
    test.each([
      ['upsert', () => upsertAppAccess(userId, 'dropbox', 'invited', 'id:test')],
      ['revoke', () => revokeAppAccess(userId, 'dropbox')],
      ['credentials lookup', () => getAppCredentials(userId, 'dropbox')],
      ['access lookup', () => getAppAccess(userId, 'dropbox')],
    ])('propagates %s query failures without saving', async (_, call) => {
      const error = new Error('Database unavailable');
      ApplicationAccess.findOne.mockRejectedValue(error);
      await expect(call()).rejects.toBe(error);
      expect(record.save).not.toHaveBeenCalled();
      expect(ApplicationAccess).not.toHaveBeenCalled();
    });

    test.each([
      [
        'new record',
        () => {
          ApplicationAccess.findOne.mockResolvedValue(null);
        },
        () => upsertAppAccess(userId, 'dropbox', 'invited', 'id:test'),
      ],
      ['existing record', () => {}, () => upsertAppAccess(userId, 'dropbox', 'invited', 'id:test')],
      [
        'revocation',
        () => {
          record.apps = [{ app: 'dropbox', credentials: 'id:test' }];
        },
        () => revokeAppAccess(userId, 'dropbox'),
      ],
    ])('does not report success when saving %s fails', async (_, setup, call) => {
      setup();
      const error = new Error('Save failed');
      record.save.mockRejectedValue(error);
      await expect(call()).rejects.toBe(error);
      expect(record.save).toHaveBeenCalledTimes(1);
    });
  });
});
