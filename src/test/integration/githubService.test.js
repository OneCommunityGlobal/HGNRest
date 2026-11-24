// Exercise the real service and Axios together with HTTP intercepted locally.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const originalToken = process.env.GITHUB_TOKEN;
const originalOrg = process.env.GITHUB_ORG_NAME;
process.env.GITHUB_TOKEN = 'test-only-token';
process.env.GITHUB_ORG_NAME = 'test-org';

const nock = require('nock');
const axios = require('axios');
const {
  sendInvitation,
  removeUser,
  checkUserMembership,
  getTeams,
  addUserToTeam,
  getUserDetails,
} = require('../../services/automation/githubService');

if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
else process.env.GITHUB_TOKEN = originalToken;
if (originalOrg === undefined) delete process.env.GITHUB_ORG_NAME;
else process.env.GITHUB_ORG_NAME = originalOrg;

const username = 'test-volunteer';
const orgPath = '/orgs/test-org';
const memberPath = `${orgPath}/memberships/${username}`;
const teamSlug = 'highest-good-network-team';
const originalProxy = axios.defaults.proxy;
const api = () =>
  nock('https://api.github.com', {
    reqheaders: {
      authorization: 'Bearer test-only-token',
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'HGN-App/1.0',
    },
  });

function profileAndMembership(state = 'active') {
  return api()
    .get(`/users/${username}`)
    .reply(200, { id: 123 })
    .get('/user/123')
    .reply(200, { name: 'Test User' })
    .get(memberPath)
    .reply(200, { state, role: 'member' });
}

beforeAll(() => {
  axios.defaults.proxy = false;
  nock.disableNetConnect();
});
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  expect(pending).toEqual([]);
});
afterAll(() => {
  axios.defaults.proxy = originalProxy;
  nock.enableNetConnect();
});

describe('GitHub service HTTP contracts', () => {
  test('sends a default organization invitation after user and membership checks', async () => {
    const scope = api()
      .get(`/users/${username}`)
      .reply(200, { id: 123 })
      .get(memberPath)
      .reply(404, { message: 'Not Found' })
      .post(`${orgPath}/invitations`, { invitee_id: 123, role: 'direct_member', team_ids: [] })
      .reply(201, { id: 456 });
    await expect(sendInvitation(username)).resolves.toBe(
      `Invitation sent to ${username} with ID: 123`,
    );
    expect(scope.isDone()).toBe(true);
  });

  test('serializes explicitly selected teams and organization role', async () => {
    const scope = api()
      .get(`/users/${username}`)
      .reply(200, { id: 123 })
      .get(memberPath)
      .reply(404, { message: 'Not Found' })
      .post(`${orgPath}/invitations`, {
        invitee_id: 123,
        role: 'billing_manager',
        team_ids: [101, 202],
      })
      .reply(201, { id: 456 });
    await expect(sendInvitation(username, 'billing_manager', [101, 202])).resolves.toContain(
      'Invitation sent',
    );
    expect(scope.isDone()).toBe(true);
  });

  test.each(['active', 'pending'])(
    'does not send another invitation for an existing %s member',
    async (state) => {
      const scope = api()
        .get(`/users/${username}`)
        .reply(200, { id: 123 })
        .get(memberPath)
        .reply(200, { state, role: 'member' });
      await expect(sendInvitation(username)).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
      });
      expect(scope.isDone()).toBe(true);
    },
  );

  test('maps a real Axios invitation validation response', async () => {
    const scope = api()
      .get(`/users/${username}`)
      .reply(200, { id: 123 })
      .get(memberPath)
      .reply(404, { message: 'Not Found' })
      .post(`${orgPath}/invitations`, { invitee_id: 123, role: 'direct_member', team_ids: [] })
      .reply(422, { message: 'Validation Failed' });
    await expect(sendInvitation(username)).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 422,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('maps a membership 404 without treating it as an API outage', async () => {
    const scope = api().get(memberPath).reply(404, { message: 'Not Found' });
    await expect(checkUserMembership(username)).resolves.toEqual({
      exists: false,
      state: null,
      role: null,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('filters disallowed organization teams from an HTTP response', async () => {
    const scope = api()
      .get(`${orgPath}/teams`)
      .reply(200, [
        { id: 101, name: 'HGN', slug: teamSlug, description: 'Development', privacy: 'closed' },
        { id: 999, name: 'Admins', slug: 'administrators', privacy: 'secret' },
      ]);
    await expect(getTeams()).resolves.toEqual([
      {
        id: 101,
        name: 'HGN',
        slug: teamSlug,
        description: 'Development',
        privacy: 'closed',
        isDefault: true,
      },
    ]);
    expect(scope.isDone()).toBe(true);
  });

  test('sends a member role to the exact team membership endpoint', async () => {
    const scope = api()
      .put(`${orgPath}/teams/${teamSlug}/memberships/${username}`, { role: 'member' })
      .reply(200, { state: 'active', role: 'member' });
    await expect(addUserToTeam(username, teamSlug)).resolves.toContain('as member');
    expect(scope.isDone()).toBe(true);
  });

  test('deletes the requested organization membership only after receiving HTTP 204', async () => {
    const scope = api().delete(memberPath).reply(204);
    await expect(removeUser(username)).resolves.toContain('removed from the organization');
    expect(scope.isDone()).toBe(true);
  });

  test('maps a real Axios removal permission error', async () => {
    const scope = api().delete(memberPath).reply(403, { message: 'Forbidden' });
    await expect(removeUser(username)).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
    expect(scope.isDone()).toBe(true);
  });

  test('combines a profile with active membership and team names over HTTP', async () => {
    const scope = profileAndMembership()
      .get(`${orgPath}/members/${username}/teams`)
      .reply(200, [{ name: 'HGN' }]);
    await expect(getUserDetails(username)).resolves.toEqual({
      name: 'Test User',
      organizationRole: 'member',
      status: 'active',
      teams: ['HGN'],
    });
    expect(scope.isDone()).toBe(true);
  });

  test('uses the fallback team endpoints and omits teams without membership', async () => {
    const scope = profileAndMembership()
      .get(`${orgPath}/members/${username}/teams`)
      .reply(404, { message: 'Not Found' })
      .get(`${orgPath}/teams`)
      .reply(200, [
        { name: 'HGN', slug: 'hgn' },
        { name: 'Admin', slug: 'admin' },
      ])
      .get(`${orgPath}/teams/hgn/members/${username}`)
      .reply(204)
      .get(`${orgPath}/teams/admin/members/${username}`)
      .reply(404, { message: 'Not Found' });
    await expect(getUserDetails(username)).resolves.toMatchObject({ teams: ['HGN'] });
    expect(scope.isDone()).toBe(true);
  });

  test('does not request team information for a pending member', async () => {
    const scope = profileAndMembership('pending');
    await expect(getUserDetails(username)).resolves.toMatchObject({ status: 'pending', teams: [] });
    expect(scope.isDone()).toBe(true);
  });

  test('maps the rate-limit reset header on a profile lookup failure', async () => {
    const scope = api()
      .get(`/users/${username}`)
      .reply(200, { id: 123 })
      .get('/user/123')
      .reply(403, { message: 'rate limit' }, { 'x-ratelimit-reset': '1795550400' });
    await expect(getUserDetails(username)).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
      message: expect.stringContaining('resets at'),
    });
    expect(scope.isDone()).toBe(true);
  });
});
