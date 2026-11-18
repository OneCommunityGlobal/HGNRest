// End-to-end check that the HGN questionnaire unlocks only after a
// Highest Good Network Dropbox invite. Runs the real controllers, model and
// access helper against an in-memory MongoDB; only Dropbox network calls are mocked.
jest.mock('../../services/automation/dropboxService', () => ({
  ...jest.requireActual('../../services/automation/dropboxService'),
  createFolderAndInvite: jest.fn(),
  deleteFolder: jest.fn(),
  getTeamFolderKeyForFolder: jest.fn(),
}));
jest.mock('../../controllers/automation/utils', () => ({
  checkAppAccess: jest.fn().mockResolvedValue(true),
}));

const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MongoMemoryServer } = require('mongodb-memory-server');
const ApplicationAccess = require('../../models/applicationAccess');
const UserProfile = require('../../models/userProfile');
const FormResponse = require('../../models/hgnFormResponse');
const dropboxService = require('../../services/automation/dropboxService');
const appAccessService = require('../../services/automation/appAccessService');
const dropboxController = require('../../controllers/automation/dropboxController');
const appAccessController = require('../../controllers/automation/appAccessController');
const hgnFormController = require('../../controllers/hgnFormResponseController')();

const admin = { requestorId: new mongoose.Types.ObjectId().toString(), role: 'Administrator' };

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createUser = async (overrides = {}) => {
  const _id = new mongoose.Types.ObjectId();
  await UserProfile.collection.insertOne({ _id, isActive: true, ...overrides });
  return _id.toString();
};

const invite = async (userId, teamFolderKey) => {
  const res = mockRes();
  await dropboxController.createFolderAndInvite(
    {
      body: {
        requestor: admin,
        folderName: 'Jane Doe',
        teamFolderKey,
        targetUser: { targetUserId: userId, email: 'jane@example.com' },
      },
    },
    res,
  );
  return res;
};

const revoke = async (userId) => {
  const res = mockRes();
  await dropboxController.deleteFolder(
    { body: { requestor: admin, targetUser: { targetUserId: userId } } },
    res,
  );
  return res;
};

const checkAccess = async (userId, role = 'Volunteer') => {
  const res = mockRes();
  await hgnFormController.getAccess({ body: { requestor: { requestorId: userId, role } } }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

const storedDropbox = async (userId) => {
  const record = await ApplicationAccess.findOne({ userId }).lean();
  return record?.apps.find((a) => a.app === 'dropbox');
};

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await ApplicationAccess.deleteMany({});
  await UserProfile.collection.deleteMany({});
  let folderCount = 0;
  dropboxService.createFolderAndInvite.mockImplementation(async (email, folderName) => {
    folderCount += 1;
    return { folderId: `id:folder${folderCount}`, folderPath: `/x/${folderName}`, folderName };
  });
  dropboxService.deleteFolder.mockResolvedValue({ message: 'deleted', method: 'permanent' });
});

describe('Questionnaire access through the Highest Good Network Dropbox invite', () => {
  it('unlocks the questionnaire after an invite to the HGN team folder', async () => {
    const userId = await createUser();

    expect((await checkAccess(userId)).body).toEqual({ eligible: false, reason: 'NOT_INVITED' });

    const res = await invite(userId, 'HGN');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(dropboxService.createFolderAndInvite).toHaveBeenCalledWith(
      'jane@example.com',
      'Jane Doe',
      'HGN',
    );
    expect(await storedDropbox(userId)).toMatchObject({
      status: 'invited',
      credentials: 'id:folder1',
      teamFolderKey: 'HGN',
    });

    const access = await checkAccess(userId);
    expect(access.status).toBe(200);
    expect(access.body).toMatchObject({ eligible: true, reason: null });
    expect(dropboxService.getTeamFolderKeyForFolder).not.toHaveBeenCalled();
  });

  it('does not unlock the questionnaire after an invite to the Administration team folder', async () => {
    const userId = await createUser();

    await invite(userId, 'ADMIN');

    expect((await storedDropbox(userId)).teamFolderKey).toBe('ADMIN');
    expect((await checkAccess(userId)).body).toEqual({
      eligible: false,
      reason: 'NOT_HGN_TEAM_FOLDER',
    });
  });

  it('rejects questionnaire submissions from people in the Administration team folder', async () => {
    const userId = await createUser();
    await invite(userId, 'ADMIN');

    const res = mockRes();
    await hgnFormController.submitFormResponse(
      {
        body: {
          requestor: { requestorId: userId, role: 'Volunteer' },
          user_id: userId,
          userInfo: { name: 'Jane', email: 'jane@example.com' },
          general: {},
          frontend: {},
          backend: {},
          followUp: {},
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'NOT_HGN_TEAM_FOLDER' }),
    );
  });

  it('accepts questionnaire submissions from people in the HGN team folder', async () => {
    const userId = await createUser();
    await invite(userId, 'HGN');
    const save = jest.spyOn(FormResponse.prototype, 'save').mockResolvedValue();

    const res = mockRes();
    await hgnFormController.submitFormResponse(
      {
        body: {
          requestor: { requestorId: userId, role: 'Volunteer' },
          user_id: userId,
          userInfo: { name: 'Jane', email: 'jane@example.com' },
          general: {},
          frontend: {},
          backend: {},
          followUp: {},
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(save).toHaveBeenCalled();
    save.mockRestore();
  });

  it('treats an invite without a team folder as the default HGN folder', async () => {
    const userId = await createUser();

    await invite(userId, undefined);

    expect(dropboxService.createFolderAndInvite).toHaveBeenCalledWith(
      'jane@example.com',
      'Jane Doe',
      undefined,
    );
    expect((await storedDropbox(userId)).teamFolderKey).toBe('HGN');
    expect((await checkAccess(userId)).body.eligible).toBe(true);
  });

  it('rejects an unknown team folder without recording an invite', async () => {
    const userId = await createUser();

    const res = await invite(userId, 'NOT_A_FOLDER');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dropboxService.createFolderAndInvite).not.toHaveBeenCalled();
    expect(await storedDropbox(userId)).toBeUndefined();
  });

  it('follows the latest invite across revoke and re-invite', async () => {
    const userId = await createUser();

    await invite(userId, 'HGN');
    expect((await checkAccess(userId)).body.eligible).toBe(true);

    expect((await revoke(userId)).status).toHaveBeenCalledWith(200);
    expect((await checkAccess(userId)).body).toEqual({
      eligible: false,
      reason: 'ACCESS_REVOKED',
    });

    await invite(userId, 'ADMIN');
    expect((await checkAccess(userId)).body.reason).toBe('NOT_HGN_TEAM_FOLDER');

    await revoke(userId);
    await invite(userId, 'HGN');
    expect((await storedDropbox(userId)).teamFolderKey).toBe('HGN');
    expect((await checkAccess(userId)).body.eligible).toBe(true);
  });

  it('keeps the Dropbox team folder when other apps are invited', async () => {
    const userId = await createUser();

    await appAccessService.upsertAppAccess(userId, 'github', 'invited', 'janedoe');
    await invite(userId, 'HGN');
    await appAccessService.upsertAppAccess(userId, 'slack', 'invited', 'jane@example.com');

    const record = await ApplicationAccess.findOne({ userId }).lean();
    expect(record.apps.map((a) => [a.app, a.teamFolderKey])).toEqual([
      ['github', null],
      ['dropbox', 'HGN'],
      ['slack', null],
    ]);
    expect((await checkAccess(userId)).body.eligible).toBe(true);
  });

  it('returns the team folder to Access Management so the UI can show it', async () => {
    const userId = await createUser();
    await invite(userId, 'HGN');

    const res = mockRes();
    await appAccessController.getAppAccess({ query: { userId } }, res);

    const { data } = res.json.mock.calls[0][0];
    expect(data.apps.find((a) => a.app === 'dropbox').teamFolderKey).toBe('HGN');
  });

  it('keeps the questionnaire closed for inactive users even with an HGN invite', async () => {
    const userId = await createUser({ isActive: false });
    await invite(userId, 'HGN');

    expect((await checkAccess(userId)).body).toEqual({ eligible: false, reason: 'INACTIVE' });
  });

  it('lets Owners open the questionnaire without any Dropbox invite', async () => {
    const userId = await createUser();

    expect((await checkAccess(userId, 'Owner')).body.eligible).toBe(true);
  });

  describe('invites made before the team folder was recorded', () => {
    const createLegacyInvite = async (userId, otherApps = []) => {
      await ApplicationAccess.collection.insertOne({
        userId,
        apps: [
          ...otherApps,
          { app: 'dropbox', status: 'invited', credentials: 'id:legacy', invitedOn: new Date() },
        ],
      });
    };

    it('looks up an HGN folder once, saves it, and unlocks the questionnaire', async () => {
      const userId = await createUser();
      await createLegacyInvite(userId, [{ app: 'github', status: 'invited', credentials: 'jd' }]);
      dropboxService.getTeamFolderKeyForFolder.mockResolvedValue('HGN');

      expect((await checkAccess(userId)).body.eligible).toBe(true);
      expect(dropboxService.getTeamFolderKeyForFolder).toHaveBeenCalledWith('id:legacy');

      const record = await ApplicationAccess.findOne({ userId }).lean();
      expect(record.apps.map((a) => [a.app, a.teamFolderKey])).toEqual([
        ['github', undefined],
        ['dropbox', 'HGN'],
      ]);

      // Later checks use the saved key and no longer call Dropbox.
      expect((await checkAccess(userId)).body.eligible).toBe(true);
      expect(dropboxService.getTeamFolderKeyForFolder).toHaveBeenCalledTimes(1);
    });

    it('keeps the questionnaire closed when the folder is in the Administration team', async () => {
      const userId = await createUser();
      await createLegacyInvite(userId);
      dropboxService.getTeamFolderKeyForFolder.mockResolvedValue('ADMIN');

      expect((await checkAccess(userId)).body.reason).toBe('NOT_HGN_TEAM_FOLDER');
      expect((await storedDropbox(userId)).teamFolderKey).toBe('ADMIN');
    });

    it('keeps the questionnaire closed and saves nothing when the folder is outside any team folder', async () => {
      const userId = await createUser();
      await createLegacyInvite(userId);
      dropboxService.getTeamFolderKeyForFolder.mockResolvedValue(null);

      expect((await checkAccess(userId)).body.reason).toBe('NOT_HGN_TEAM_FOLDER');
      expect((await storedDropbox(userId)).teamFolderKey).toBeUndefined();
    });

    it('reports an error instead of a decision when Dropbox cannot be reached', async () => {
      const userId = await createUser();
      await createLegacyInvite(userId);
      dropboxService.getTeamFolderKeyForFolder.mockRejectedValue(new Error('Dropbox down'));

      const access = await checkAccess(userId);

      expect(access.status).toBe(500);
      expect(access.body.error).toMatch(/Dropbox down/);
      expect((await storedDropbox(userId)).teamFolderKey).toBeUndefined();
    });
  });
});
