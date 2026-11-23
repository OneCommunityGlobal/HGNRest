// Exercise the real service and Dropbox SDK together; intercept all HTTP.
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('dropbox', () => {
  const actual = jest.requireActual('dropbox');
  return {
    ...actual,
    Dropbox: jest.fn(({ fetch }) => new actual.Dropbox({ accessToken: 'test-only-token', fetch })),
  };
});

const nock = require('nock');
const {
  createFolderAndInvite,
  createFolderWithSubfolder,
  getFolderDetails,
  deleteFolder,
} = require('../../services/automation/dropboxService');

const teamPath = '/_Highest Good Network Team';
const userPath = `${teamPath}/SDK Test User`;
const folderId = 'id:sdk-test-folder';
const sharedId = 'sdk-test-share';
const email = 'sdk-test@example.com';
const metadata = {
  '.tag': 'folder',
  id: folderId,
  name: 'SDK Test User',
  path_display: userPath,
};
const api = () =>
  nock('https://api.dropboxapi.com', {
    reqheaders: { authorization: 'Bearer test-only-token' },
  });

function folderCreation() {
  return api()
    .post('/2/files/get_metadata', { path: teamPath })
    .reply(200, { '.tag': 'folder' })
    .post('/2/files/get_metadata', { path: userPath })
    .reply(409, {
      error_summary: 'path/not_found/',
      error: { '.tag': 'path', path: { '.tag': 'not_found' } },
    })
    .post('/2/files/create_folder_v2', { path: userPath })
    .reply(200, { metadata })
    .post('/2/files/create_folder_v2', { path: `${userPath}/Week 1` })
    .reply(200, { metadata });
}

function invitation(scope) {
  return scope.post('/2/sharing/add_folder_member', {
    shared_folder_id: sharedId,
    members: [{ member: { '.tag': 'email', email }, access_level: { '.tag': 'editor' } }],
    quiet: false,
  });
}

beforeAll(() => nock.disableNetConnect());
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  expect(pending).toEqual([]);
});
afterAll(() => {
  nock.enableNetConnect();
});

describe('Dropbox service and SDK HTTP contracts', () => {
  test('creates both folders, shares and invites with the SDK request bodies', async () => {
    const scope = folderCreation()
      .post('/2/sharing/share_folder', { path: userPath })
      .reply(200, { '.tag': 'complete', shared_folder_id: sharedId });
    invitation(scope)
      .reply(200, null)
      .post('/2/files/get_metadata', { path: userPath })
      .reply(200, metadata);

    await expect(createFolderAndInvite(email, 'SDK Test User')).resolves.toMatchObject({
      folderId,
      sharedFolderId: sharedId,
      folderPath: userPath,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('reads the asynchronous share result returned by the real SDK', async () => {
    const scope = folderCreation()
      .post('/2/sharing/share_folder', { path: userPath })
      .reply(200, { '.tag': 'async_job_id', async_job_id: 'sdk-job' })
      .post('/2/sharing/check_share_job_status', { async_job_id: 'sdk-job' })
      .reply(200, { '.tag': 'complete', shared_folder_id: sharedId });
    invitation(scope)
      .reply(200, null)
      .post('/2/files/get_metadata', { path: userPath })
      .reply(200, metadata);

    await expect(createFolderAndInvite(email, 'SDK Test User')).resolves.toMatchObject({
      folderId,
      sharedFolderId: sharedId,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('cleans up the created folder after a real SDK invitation rejection', async () => {
    const scope = folderCreation()
      .post('/2/sharing/share_folder', { path: userPath })
      .reply(200, { '.tag': 'complete', shared_folder_id: sharedId });
    invitation(scope)
      .reply(409, { error: { '.tag': 'invalid_email' }, error_summary: 'invalid_email/' })
      .post('/2/files/delete_v2', { path: userPath })
      .reply(200, { metadata });

    await expect(createFolderAndInvite(email, 'SDK Test User')).rejects.toMatchObject({
      name: 'ProcessError',
      statusCode: 500,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('maps an actual SDK missing-team-folder response to a 404', async () => {
    const scope = api()
      .post('/2/files/get_metadata', { path: teamPath })
      .reply(409, { error: { '.tag': 'path', path: { '.tag': 'not_found' } } });
    await expect(createFolderWithSubfolder('SDK Test User')).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('combines SDK folder metadata, contents and shared-member responses', async () => {
    const scope = api()
      .post('/2/files/get_metadata', { path: folderId })
      .reply(200, { ...metadata, sharing_info: { shared_folder_id: sharedId } })
      .post('/2/files/list_folder', { path: folderId })
      .reply(200, {
        entries: [
          { '.tag': 'folder', name: 'Week 1' },
          { '.tag': 'file', name: 'proof.jpg' },
        ],
      })
      .post('/2/sharing/list_folder_members', { shared_folder_id: sharedId })
      .reply(200, { users: [{ user: { email }, access_type: { '.tag': 'editor' } }], groups: [] });
    await expect(getFolderDetails(folderId)).resolves.toMatchObject({
      folderId,
      fileCount: 2,
      subfolders: ['Week 1'],
      isShared: true,
      sharedMembers: [{ email, role: 'editor' }],
    });
    expect(scope.isDone()).toBe(true);
  });

  test('deletes the exact folder ID using the SDK endpoint', async () => {
    const scope = api().post('/2/files/delete_v2', { path: folderId }).reply(200, { metadata });
    await expect(deleteFolder(folderId)).resolves.toMatchObject({
      success: true,
      method: 'folder_id',
    });
    expect(scope.isDone()).toBe(true);
  });

  test('maps an SDK deletion path-lookup error to a 404', async () => {
    const scope = api()
      .post('/2/files/delete_v2', { path: folderId })
      .reply(409, { error: { '.tag': 'path_lookup', path_lookup: { '.tag': 'not_found' } } });
    await expect(deleteFolder(folderId)).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('maps a rate-limit response from the SDK when reading folder details', async () => {
    const scope = api()
      .post('/2/files/get_metadata', { path: folderId })
      .reply(429, { error: { '.tag': 'too_many_requests' } });
    await expect(getFolderDetails(folderId)).rejects.toMatchObject({
      name: 'RateLimitError',
      statusCode: 429,
    });
    expect(scope.isDone()).toBe(true);
  });
});
