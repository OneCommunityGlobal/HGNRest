jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('isomorphic-fetch', () => jest.fn());
jest.mock('dropbox', () => ({
  Dropbox: jest.fn(() => ({
    filesGetMetadata: jest.fn(),
    filesCreateFolderV2: jest.fn(),
    filesDeleteV2: jest.fn(),
    filesListFolder: jest.fn(),
    sharingShareFolder: jest.fn(),
    sharingCheckShareJobStatus: jest.fn(),
    sharingAddFolderMember: jest.fn(),
    sharingListFolderMembers: jest.fn(),
  })),
}));

const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
const {
  getTeamFolderPath,
  createFolderWithSubfolder,
  createFolderAndInvite,
  deleteFolder,
  getFolderDetails,
} = require('./dropboxService');

const dbx = Dropbox.mock.results[0].value;
const teamPath = '/_Highest Good Network Team';
const userPath = `${teamPath}/Test User`;
const folderId = 'id:test-folder';
const sharedId = 'test-share';
const email = 'volunteer@example.com';
const missingPath = () => ({ status: 409, error: { error: { '.tag': 'path' } } });
const apiError = (status, tag, message = 'Dropbox request failed') => ({
  status,
  message,
  error: { error: { '.tag': tag } },
});
const folder = (overrides = {}) => ({
  '.tag': 'folder',
  id: folderId,
  name: 'Test User',
  path_display: userPath,
  ...overrides,
});

function prepareCreation() {
  dbx.filesGetMetadata
    .mockResolvedValueOnce({ result: folder({ name: '_Highest Good Network Team' }) })
    .mockRejectedValueOnce(missingPath())
    .mockResolvedValue({ result: folder() });
  dbx.filesCreateFolderV2.mockResolvedValue({ result: { metadata: folder() } });
  dbx.sharingShareFolder.mockResolvedValue({
    result: { '.tag': 'complete', shared_folder_id: sharedId },
  });
  dbx.sharingAddFolderMember.mockResolvedValue({ result: { invited: true } });
  dbx.filesDeleteV2.mockResolvedValue({ result: { metadata: folder() } });
}

async function finishPolling(promise) {
  // Observe rejection before advancing fake time to avoid unhandled rejections.
  const outcome = promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await jest.runAllTimersAsync();
  return outcome;
}

beforeEach(() => {
  Object.values(dbx).forEach((method) => method.mockReset());
  fetch.mockReset();
  fetch.mockImplementation(() => {
    throw new Error('Unexpected network access in Dropbox unit tests');
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  expect(fetch).not.toHaveBeenCalled();
});

describe('Dropbox folder paths and creation', () => {
  test('uses HGN by default and resolves the Administration folder', () => {
    expect(getTeamFolderPath()).toBe(teamPath);
    expect(getTeamFolderPath('ADMIN')).toBe('/_Administration Team');
  });

  test.each([null, '', '  ', 42])('rejects invalid team key %p', (key) => {
    expect(() => getTeamFolderPath(key)).toThrow(
      expect.objectContaining({ name: 'ValidationError', statusCode: 400 }),
    );
  });

  test('reports an unknown team key', () => {
    expect(() => getTeamFolderPath('UNKNOWN')).toThrow(
      expect.objectContaining({ name: 'NotFoundError', statusCode: 404 }),
    );
  });

  test.each([null, '', '  ', 42])('rejects invalid user folder name %p', async (name) => {
    await expect(createFolderWithSubfolder(name)).rejects.toThrow('User folder name is required');
    expect(dbx.filesGetMetadata).not.toHaveBeenCalled();
    expect(dbx.filesCreateFolderV2).not.toHaveBeenCalled();
  });

  test.each([null, '', '  ', 42, 'UNKNOWN'])(
    'does not create folders for invalid team key %p',
    async (key) => {
      await expect(createFolderWithSubfolder('Test User', key)).rejects.toThrow();
      expect(dbx.filesGetMetadata).not.toHaveBeenCalled();
      expect(dbx.filesCreateFolderV2).not.toHaveBeenCalled();
    },
  );

  test('creates the user folder before its Week 1 folder with sanitized paths', async () => {
    prepareCreation();
    const sanitizedPath = `${teamPath}/Test_________User`;
    await expect(createFolderWithSubfolder(' Test<>:"/\\|?*User ')).resolves.toBe(sanitizedPath);
    expect(dbx.filesGetMetadata.mock.calls).toEqual([
      [{ path: teamPath }],
      [{ path: sanitizedPath }],
    ]);
    expect(dbx.filesCreateFolderV2.mock.calls).toEqual([
      [{ path: sanitizedPath }],
      [{ path: `${sanitizedPath}/Week 1` }],
    ]);
  });

  test('creates folders under the explicitly selected Administration team', async () => {
    prepareCreation();
    await expect(createFolderWithSubfolder('Test User', 'ADMIN')).resolves.toBe(
      '/_Administration Team/Test User',
    );
    expect(dbx.filesGetMetadata).toHaveBeenNthCalledWith(1, { path: '/_Administration Team' });
    expect(dbx.filesCreateFolderV2).toHaveBeenLastCalledWith({
      path: '/_Administration Team/Test User/Week 1',
    });
  });

  test.each([
    [missingPath(), 'NotFoundError', 404],
    [apiError(401), 'UnauthorizedError', 401],
    [apiError(403), 'ForbiddenError', 403],
    [apiError(429), 'APIError', 429],
    [new Error('offline'), 'APIError', 500],
  ])('does not create folders when team validation fails (%p)', async (error, name, statusCode) => {
    dbx.filesGetMetadata.mockRejectedValue(error);
    await expect(createFolderWithSubfolder('Test User')).rejects.toMatchObject({
      name,
      statusCode,
    });
    expect(dbx.filesGetMetadata).toHaveBeenCalledTimes(1);
    expect(dbx.filesCreateFolderV2).not.toHaveBeenCalled();
  });

  test('refuses a non-folder team path without creating or sharing anything', async () => {
    dbx.filesGetMetadata.mockResolvedValue({ result: { '.tag': 'file' } });
    await expect(createFolderWithSubfolder('Test User')).rejects.toThrow('not a folder');
    expect(dbx.filesCreateFolderV2).not.toHaveBeenCalled();
    expect(dbx.sharingShareFolder).not.toHaveBeenCalled();
  });

  test('refuses an existing user folder without overwriting it', async () => {
    dbx.filesGetMetadata.mockResolvedValue({ result: folder() });
    await expect(createFolderWithSubfolder('Test User')).rejects.toThrow('already exists');
    expect(dbx.filesCreateFolderV2).not.toHaveBeenCalled();
  });

  test('does not treat a permission error as a missing user folder', async () => {
    dbx.filesGetMetadata
      .mockResolvedValueOnce({ result: folder() })
      .mockRejectedValueOnce(apiError(403));
    await expect(createFolderWithSubfolder('Test User')).rejects.toMatchObject({ status: 403 });
    expect(dbx.filesCreateFolderV2).not.toHaveBeenCalled();
  });

  test('stops before Week 1 if creating the user folder fails', async () => {
    prepareCreation();
    const error = apiError(409, 'path');
    dbx.filesCreateFolderV2.mockRejectedValueOnce(error);
    await expect(createFolderWithSubfolder('Test User')).rejects.toBe(error);
    expect(dbx.filesCreateFolderV2).toHaveBeenCalledTimes(1);
  });

  test('reports failure to create Week 1 instead of reporting success', async () => {
    prepareCreation();
    const error = new Error('Week 1 creation failed');
    dbx.filesCreateFolderV2.mockResolvedValueOnce({}).mockRejectedValueOnce(error);
    await expect(createFolderWithSubfolder('Test User')).rejects.toBe(error);
    expect(dbx.filesCreateFolderV2).toHaveBeenCalledTimes(2);
  });
});

describe('Dropbox creation and invitations', () => {
  test.each([
    [null, 'Test User', 'HGN', 'ValidationError', 400],
    ['  ', 'Test User', 'HGN', 'ValidationError', 400],
    [42, 'Test User', 'HGN', 'ValidationError', 400],
    ['invalid-address', 'Test User', 'HGN', 'ValidationError', 400],
    ['a@b', 'Test User', 'HGN', 'ValidationError', 400],
    [email, null, 'HGN', 'ValidationError', 400],
    [email, '  ', 'HGN', 'ValidationError', 400],
    [email, 42, 'HGN', 'ValidationError', 400],
    [email, 'Test User', null, 'ValidationError', 400],
    [email, 'Test User', '  ', 'ValidationError', 400],
    [email, 'Test User', 42, 'ValidationError', 400],
    [email, 'Test User', 'UNKNOWN', 'NotFoundError', 404],
  ])(
    'rejects invalid invitation inputs (%p, %p, %p)',
    async (address, user, team, name, statusCode) => {
      await expect(createFolderAndInvite(address, user, team)).rejects.toMatchObject({
        name,
        statusCode,
      });
      expect(dbx.filesGetMetadata).not.toHaveBeenCalled();
      expect(dbx.sharingAddFolderMember).not.toHaveBeenCalled();
    },
  );

  test('creates, shares and invites an editor, returning the created folder identifiers', async () => {
    prepareCreation();
    await expect(createFolderAndInvite(` ${email} `, 'Test User')).resolves.toEqual({
      inviteResponse: { result: { invited: true } },
      folderPath: userPath,
      sharedFolderId: sharedId,
      folderId,
      folderName: 'Test User',
    });
    expect(dbx.sharingShareFolder).toHaveBeenCalledWith({ path: userPath });
    expect(dbx.sharingAddFolderMember).toHaveBeenCalledWith({
      shared_folder_id: sharedId,
      members: [{ member: { '.tag': 'email', email }, access_level: { '.tag': 'editor' } }],
      quiet: false,
    });
    expect(dbx.filesGetMetadata).toHaveBeenLastCalledWith({ path: userPath });
    expect(dbx.filesCreateFolderV2.mock.invocationCallOrder[1]).toBeLessThan(
      dbx.sharingShareFolder.mock.invocationCallOrder[0],
    );
    expect(dbx.sharingShareFolder.mock.invocationCallOrder[0]).toBeLessThan(
      dbx.sharingAddFolderMember.mock.invocationCallOrder[0],
    );
    expect(dbx.filesDeleteV2).not.toHaveBeenCalled();
  });

  test('waits for an asynchronous share to complete before sending an invitation', async () => {
    jest.useFakeTimers();
    prepareCreation();
    dbx.sharingShareFolder.mockResolvedValue({
      result: { '.tag': 'async_job_id', async_job_id: ' job ' },
    });
    dbx.sharingCheckShareJobStatus
      .mockResolvedValueOnce({ result: { '.tag': 'in_progress' } })
      .mockResolvedValueOnce({ result: { '.tag': 'complete', shared_folder_id: sharedId } });
    const outcome = await finishPolling(createFolderAndInvite(email, 'Test User'));
    expect(outcome.value).toMatchObject({ folderId, sharedFolderId: sharedId });
    expect(dbx.sharingCheckShareJobStatus).toHaveBeenCalledTimes(2);
    expect(dbx.sharingCheckShareJobStatus).toHaveBeenCalledWith({ async_job_id: 'job' });
    expect(dbx.sharingCheckShareJobStatus.mock.invocationCallOrder[1]).toBeLessThan(
      dbx.sharingAddFolderMember.mock.invocationCallOrder[0],
    );
  });

  test('backs off repeated share checks and stops at the default timeout', async () => {
    jest.useFakeTimers().setSystemTime(0);
    prepareCreation();
    const pollTimes = [];
    dbx.sharingShareFolder.mockResolvedValue({
      result: { '.tag': 'async_job_id', async_job_id: 'job' },
    });
    dbx.sharingCheckShareJobStatus.mockImplementation(async () => {
      pollTimes.push(Date.now());
      return { result: { '.tag': 'in_progress' } };
    });
    const outcome = await finishPolling(createFolderAndInvite(email, 'Test User'));
    expect(outcome.error).toMatchObject({ name: 'TimeoutError', statusCode: 408 });
    expect(pollTimes).toEqual([0, 200, 600, 1400, 3000, 6200, 11200, 16200, 21200, 26200]);
    expect(dbx.sharingAddFolderMember).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([
    [{ result: { '.tag': 'async_job_id', async_job_id: '' } }, 'ValidationError', 400],
    [{ result: { '.tag': 'async_job_id', async_job_id: 42 } }, 'ValidationError', 400],
  ])('rejects an invalid asynchronous job ID (%p)', async (response, name, statusCode) => {
    prepareCreation();
    dbx.sharingShareFolder.mockResolvedValue(response);
    await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
      name,
      statusCode,
    });
    expect(dbx.sharingCheckShareJobStatus).not.toHaveBeenCalled();
    expect(dbx.sharingAddFolderMember).not.toHaveBeenCalled();
  });

  test('reports a failed share job without inviting the user', async () => {
    prepareCreation();
    dbx.sharingShareFolder.mockResolvedValue({
      result: { '.tag': 'async_job_id', async_job_id: 'job' },
    });
    dbx.sharingCheckShareJobStatus.mockResolvedValue({
      result: { '.tag': 'failed', failed: { '.tag': 'access_error' } },
    });
    await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
      name: 'ProcessError',
      statusCode: 500,
      message: expect.stringContaining('access_error'),
    });
    expect(dbx.sharingAddFolderMember).not.toHaveBeenCalled();
  });

  test.each([
    [apiError(400), 'ValidationError', 400],
    [apiError(404), 'NotFoundError', 404],
    [apiError(503), 'APIError', 503],
    [new Error('offline'), 'APIError', 500],
    [Object.assign(new Error('custom'), { statusCode: 418 }), 'Error', 418],
  ])('reports a share polling error (%p)', async (error, name, statusCode) => {
    prepareCreation();
    dbx.sharingShareFolder.mockResolvedValue({
      result: { '.tag': 'async_job_id', async_job_id: 'job' },
    });
    dbx.sharingCheckShareJobStatus.mockRejectedValue(error);
    await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
      name,
      statusCode,
    });
    expect(dbx.sharingAddFolderMember).not.toHaveBeenCalled();
  });

  test.each([
    [{ result: { '.tag': 'unexpected' } }, 'Unexpected share tag'],
    [{ result: { '.tag': 'complete' } }, 'Missing shared_folder_id'],
  ])('cleans up an unusable share response (%p)', async (response, message) => {
    prepareCreation();
    dbx.sharingShareFolder.mockResolvedValue(response);
    await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
      name: 'ProcessError',
      statusCode: 500,
      message: expect.stringContaining(message),
    });
    expect(dbx.filesDeleteV2).toHaveBeenCalledWith({ path: userPath });
    expect(dbx.sharingAddFolderMember).not.toHaveBeenCalled();
  });

  test.each(['sharingShareFolder', 'sharingAddFolderMember'])(
    'cleans up the created folder when %s fails',
    async (method) => {
      prepareCreation();
      dbx[method].mockRejectedValue(new Error('request failed'));
      await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
        name: 'ProcessError',
        statusCode: 500,
        message: expect.stringContaining('request failed'),
      });
      expect(dbx.filesDeleteV2).toHaveBeenCalledTimes(1);
      expect(dbx.filesDeleteV2).toHaveBeenCalledWith({ path: userPath });
    },
  );

  test('cleans up when metadata retrieval fails after the invitation', async () => {
    prepareCreation();
    dbx.filesGetMetadata.mockRejectedValue(new Error('metadata unavailable'));
    await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
      name: 'ProcessError',
    });
    expect(dbx.sharingAddFolderMember).toHaveBeenCalledTimes(1);
    expect(dbx.filesDeleteV2).toHaveBeenCalledWith({ path: userPath });
  });

  test('retains the original process error if cleanup also fails', async () => {
    prepareCreation();
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    dbx.sharingAddFolderMember.mockRejectedValue(new Error('invite failed'));
    dbx.filesDeleteV2.mockRejectedValue(new Error('cleanup failed'));
    await expect(createFolderAndInvite(email, 'Test User')).rejects.toThrow('invite failed');
    expect(log).toHaveBeenCalledWith(
      'Failed to cleanup user folder after error:',
      'cleanup failed',
    );
  });

  test('preserves a typed team-folder error without attempting deletion', async () => {
    dbx.filesGetMetadata.mockRejectedValue(missingPath());
    await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
    expect(dbx.filesDeleteV2).not.toHaveBeenCalled();
    expect(dbx.sharingShareFolder).not.toHaveBeenCalled();
  });

  test.each([
    [apiError(400), 'ValidationError', 400],
    [apiError(401), 'UnauthorizedError', 401],
    [apiError(403), 'ForbiddenError', 403],
    [apiError(409, 'other'), 'ConflictError', 409],
    [apiError(503), 'APIError', 503],
    [new Error('offline'), 'APIError', 500],
  ])(
    'maps pre-creation failures without deleting an existing folder (%p)',
    async (error, name, statusCode) => {
      dbx.filesGetMetadata.mockResolvedValueOnce({ result: folder() }).mockRejectedValueOnce(error);
      await expect(createFolderAndInvite(email, 'Test User')).rejects.toMatchObject({
        name,
        statusCode,
      });
      expect(dbx.filesDeleteV2).not.toHaveBeenCalled();
      expect(dbx.sharingAddFolderMember).not.toHaveBeenCalled();
    },
  );
});

describe('Dropbox folder deletion', () => {
  test.each([undefined, null, '', '  ', 42])('rejects invalid folder ID %p', async (id) => {
    await expect(deleteFolder(id)).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(dbx.filesDeleteV2).not.toHaveBeenCalled();
  });

  test('deletes by the trimmed folder ID and reports success', async () => {
    dbx.filesDeleteV2.mockResolvedValue({});
    await expect(deleteFolder(` ${folderId} `)).resolves.toEqual({
      success: true,
      method: 'folder_id',
      message: 'User folder deleted successfully',
    });
    expect(dbx.filesDeleteV2).toHaveBeenCalledWith({ path: folderId });
  });

  test.each([
    [apiError(409, 'path_lookup'), 'NotFoundError', 404],
    [apiError(409, 'path_write'), 'ConflictError', 409],
    [apiError(409, 'other'), 'APIError', 409],
    [apiError(400), 'ValidationError', 400],
    [apiError(401), 'UnauthorizedError', 401],
    [apiError(403), 'ForbiddenError', 403],
    [apiError(404), 'NotFoundError', 404],
    [apiError(503), 'APIError', 503],
    [new Error('offline'), 'APIError', 500],
  ])('maps deletion failures (%p)', async (error, name, statusCode) => {
    dbx.filesDeleteV2.mockRejectedValue(error);
    await expect(deleteFolder(folderId)).rejects.toMatchObject({ name, statusCode });
  });

  test('includes the write-conflict reason in the deletion error', async () => {
    const error = apiError(409, 'path_write');
    error.error.error.reason = { '.tag': 'no_write_permission' };
    dbx.filesDeleteV2.mockRejectedValue(error);
    await expect(deleteFolder(folderId)).rejects.toThrow('no_write_permission');
  });

  test('includes the API validation summary in a bad-request error', async () => {
    const error = apiError(400);
    error.error.error_summary = 'malformed_path';
    dbx.filesDeleteV2.mockRejectedValue(error);
    await expect(deleteFolder(folderId)).rejects.toThrow('malformed_path');
  });
});

describe('Dropbox folder details', () => {
  beforeEach(() => {
    dbx.filesGetMetadata.mockResolvedValue({ result: folder() });
    dbx.filesListFolder.mockResolvedValue({ result: { entries: [] } });
  });

  test.each([undefined, null, '', '  ', 42])('rejects invalid folder ID %p', async (id) => {
    await expect(getFolderDetails(id)).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(dbx.filesGetMetadata).not.toHaveBeenCalled();
  });

  test('returns metadata and subfolder names without treating files as folders', async () => {
    dbx.filesGetMetadata.mockResolvedValue({
      result: folder({
        server_modified: '2026-11-23T12:00:00Z',
        size: 128,
        shared_folder_id: sharedId,
        parent_shared_folder_id: 'parent',
      }),
    });
    dbx.filesListFolder.mockResolvedValue({
      result: {
        entries: [
          { '.tag': 'folder', name: 'Week 1' },
          { '.tag': 'file', name: 'proof.jpg' },
        ],
      },
    });
    await expect(getFolderDetails(folderId)).resolves.toEqual({
      folderId,
      folderName: 'Test User',
      folderPath: userPath,
      created: '2026-11-23T12:00:00Z',
      size: 128,
      fileCount: 2,
      teamFolder: '_Highest Good Network Team',
      subfolders: ['Week 1'],
      isShared: false,
      sharingPermissions: null,
      sharedMembers: [],
      sharedFolderId: sharedId,
      parentSharedFolderId: 'parent',
      sharingInfo: undefined,
    });
    expect(dbx.filesListFolder).toHaveBeenCalledWith({ path: folderId });
    expect(dbx.sharingListFolderMembers).not.toHaveBeenCalled();
  });

  test('supplies defaults for an empty root folder', async () => {
    dbx.filesGetMetadata.mockResolvedValue({ result: folder({ path_display: '' }) });
    await expect(getFolderDetails(folderId)).resolves.toMatchObject({
      created: null,
      size: 'Unknown',
      fileCount: 0,
      teamFolder: 'Unknown',
      subfolders: [],
    });
  });

  test('combines individual and group sharing permissions', async () => {
    const sharingInfo = { shared_folder_id: sharedId, policy: { acl_update_policy: 'owner' } };
    dbx.filesGetMetadata.mockResolvedValue({ result: folder({ sharing_info: sharingInfo }) });
    dbx.sharingListFolderMembers.mockResolvedValue({
      result: {
        users: [
          { user: { email }, access_type: { '.tag': 'editor' } },
          { user: { email: 'viewer@example.com' }, access_type: {} },
        ],
        groups: [
          { group: { group_name: 'Test Team' }, access_type: { '.tag': 'owner' } },
          { group: { group_name: 'Other Team' }, access_type: {} },
        ],
      },
    });
    await expect(getFolderDetails(folderId)).resolves.toMatchObject({
      isShared: true,
      sharingPermissions: sharingInfo.policy,
      sharingInfo,
      sharedMembers: [
        { email, role: 'editor' },
        { email: 'viewer@example.com', role: 'viewer' },
        { email: 'Test Team (Group)', role: 'owner' },
        { email: 'Other Team (Group)', role: 'viewer' },
      ],
    });
    expect(dbx.sharingListFolderMembers).toHaveBeenCalledWith({ shared_folder_id: sharedId });
  });

  test('handles member responses without users or groups', async () => {
    dbx.filesGetMetadata.mockResolvedValue({
      result: folder({ sharing_info: { shared_folder_id: sharedId } }),
    });
    dbx.sharingListFolderMembers.mockResolvedValue({ result: {} });
    await expect(getFolderDetails(folderId)).resolves.toMatchObject({
      sharedMembers: [],
      isShared: false,
    });
  });

  test.each([true, false])(
    'falls back to team access when member lookup fails (read-only %p)',
    async (readOnly) => {
      dbx.filesGetMetadata.mockResolvedValue({
        result: folder({
          sharing_info: {
            shared_folder_id: sharedId,
            read_only: readOnly,
          },
        }),
      });
      dbx.sharingListFolderMembers.mockRejectedValue(apiError(403));
      await expect(getFolderDetails(folderId)).resolves.toMatchObject({
        isShared: true,
        sharedMembers: [{ email: 'Team members', role: readOnly ? 'viewer' : 'editor' }],
      });
    },
  );

  test.each([true, false])(
    'uses metadata sharing access without a shared-folder ID (read-only %p)',
    async (readOnly) => {
      dbx.filesGetMetadata.mockResolvedValue({
        result: folder({ sharing_info: { read_only: readOnly } }),
      });
      await expect(getFolderDetails(folderId)).resolves.toMatchObject({
        isShared: true,
        sharedMembers: [{ email: 'Team members', role: readOnly ? 'viewer' : 'editor' }],
      });
      expect(dbx.sharingListFolderMembers).not.toHaveBeenCalled();
    },
  );

  test('rejects a file ID before listing its contents', async () => {
    dbx.filesGetMetadata.mockResolvedValue({ result: { '.tag': 'file' } });
    await expect(getFolderDetails(folderId)).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(dbx.filesListFolder).not.toHaveBeenCalled();
  });

  test.each([
    [Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }), 'NetworkError', 503],
    [Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' }), 'NetworkError', 503],
    [Object.assign(new Error('aborted'), { code: 'ECONNABORTED' }), 'TimeoutError', 408],
    [new Error('request timeout'), 'TimeoutError', 408],
    [apiError(409, 'path'), 'NotFoundError', 404],
    [apiError(409, 'shared_folder_no_permission'), 'ForbiddenError', 403],
    [apiError(409, 'other'), 'ConflictError', 409],
    [apiError(403), 'ForbiddenError', 403],
    [apiError(401), 'UnauthorizedError', 401],
    [apiError(400), 'ValidationError', 400],
    [apiError(429), 'RateLimitError', 429],
    [apiError(503), 'ServerError', 503],
    [new Error('unexpected'), 'APIError', 500],
    [apiError(422), 'APIError', 422],
  ])('maps metadata lookup failures (%p)', async (error, name, statusCode) => {
    dbx.filesGetMetadata.mockRejectedValue(error);
    await expect(getFolderDetails(folderId)).rejects.toMatchObject({ name, statusCode });
  });

  test('preserves a typed dependency error', async () => {
    const error = Object.assign(new Error('custom failure'), { statusCode: 418 });
    dbx.filesListFolder.mockRejectedValue(error);
    await expect(getFolderDetails(folderId)).rejects.toBe(error);
  });

  test('reports a folder-content lookup failure rather than returning partial details', async () => {
    dbx.filesListFolder.mockRejectedValue(apiError(503));
    await expect(getFolderDetails(folderId)).rejects.toMatchObject({
      name: 'ServerError',
      statusCode: 503,
    });
  });
});
