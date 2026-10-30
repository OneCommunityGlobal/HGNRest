const mockDbx = { filesGetMetadata: jest.fn() };
jest.mock('dropbox', () => ({ Dropbox: jest.fn(() => mockDbx) }));

const {
  getTeamFolderKeyForFolder,
  getAvailableTeamFolders,
  TEAM_FOLDERS,
  DEFAULT_TEAM_FOLDER,
} = require('../dropboxService');

const withPath = (pathDisplay) =>
  mockDbx.filesGetMetadata.mockResolvedValue({ result: { path_display: pathDisplay } });

describe('getTeamFolderKeyForFolder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds the Highest Good Network team folder', async () => {
    withPath('/_Highest Good Network Team/Jane Doe');
    await expect(getTeamFolderKeyForFolder('id:abc')).resolves.toBe('HGN');
    expect(mockDbx.filesGetMetadata).toHaveBeenCalledWith({ path: 'id:abc' });
  });

  it('finds the Administration team folder', async () => {
    withPath('/_Administration Team/Jane Doe');
    await expect(getTeamFolderKeyForFolder('id:abc')).resolves.toBe('ADMIN');
  });

  it('ignores letter case in the folder path', async () => {
    withPath('/_highest good network team/Jane Doe');
    await expect(getTeamFolderKeyForFolder('id:abc')).resolves.toBe('HGN');
  });

  it('does not match a folder whose name only contains a team folder name', async () => {
    withPath('/Old _Highest Good Network Team/Jane Doe');
    await expect(getTeamFolderKeyForFolder('id:abc')).resolves.toBeNull();
  });

  it('does not match a team folder name used deeper in the path', async () => {
    withPath('/Archive/_Highest Good Network Team/Jane Doe');
    await expect(getTeamFolderKeyForFolder('id:abc')).resolves.toBeNull();
  });

  it('returns null for a folder at the Dropbox root', async () => {
    withPath('/Jane Doe');
    await expect(getTeamFolderKeyForFolder('id:abc')).resolves.toBeNull();
  });

  it('passes Dropbox errors on to the caller', async () => {
    mockDbx.filesGetMetadata.mockRejectedValue(new Error('path/not_found'));
    await expect(getTeamFolderKeyForFolder('id:missing')).rejects.toThrow('path/not_found');
  });
});

describe('team folder configuration', () => {
  it('keeps HGN as the default team folder offered to admins', () => {
    expect(DEFAULT_TEAM_FOLDER).toBe('HGN');
    expect(getAvailableTeamFolders()).toEqual([
      { key: 'HGN', name: 'Highest Good Network Team', isDefault: true },
      { key: 'ADMIN', name: 'Administration Team', isDefault: false },
    ]);
    expect(TEAM_FOLDERS.HGN).toBe('_Highest Good Network Team');
  });
});
