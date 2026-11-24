// Exercise the real service and Axios together with HTTP intercepted locally.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const originalToken = process.env.SENTRY_API_TOKEN;
const originalOrg = process.env.SENTRY_ORG_SLUG;
process.env.SENTRY_API_TOKEN = 'test-only-token';
process.env.SENTRY_ORG_SLUG = 'test-org';

const nock = require('nock');
const axios = require('axios');
const {
  getTeams,
  findMemberByEmail,
  inviteUser,
  removeUser,
  getUserDetails,
} = require('../../services/automation/sentryService');

if (originalToken === undefined) delete process.env.SENTRY_API_TOKEN;
else process.env.SENTRY_API_TOKEN = originalToken;
if (originalOrg === undefined) delete process.env.SENTRY_ORG_SLUG;
else process.env.SENTRY_ORG_SLUG = originalOrg;

const orgPath = '/api/0/organizations/test-org';
const membersPath = `${orgPath}/members/`;
const email = 'volunteer@example.com';
const member = {
  id: '42',
  email,
  name: 'Test Volunteer',
  orgRole: 'member',
  pending: false,
  dateCreated: '2026-11-01T00:00:00Z',
};
const teams = [
  { slug: 'frontend', name: 'Frontend' },
  { slug: 'backend', name: 'Backend' },
];
const originalProxy = axios.defaults.proxy;
const api = () =>
  nock('https://sentry.io', {
    reqheaders: { authorization: 'Bearer test-only-token', 'content-type': 'application/json' },
  });
const search = (scope, records, queryEmail = email) =>
  scope.get(membersPath).query({ query: queryEmail }).reply(200, records);
function beforeRemoval(selectedTeams = []) {
  let scope = search(api(), [member]);
  scope = search(scope, [member]);
  return scope.get(`${orgPath}/teams/`).reply(200, selectedTeams);
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

describe('Sentry service HTTP contracts', () => {
  test('retrieves teams with the configured organization and authentication', async () => {
    const scope = api().get(`${orgPath}/teams/`).reply(200, teams);
    await expect(getTeams()).resolves.toEqual(teams);
    expect(scope.isDone()).toBe(true);
  });
  test('serializes a plus-address email query and matches case-insensitively', async () => {
    const queryEmail = 'Volunteer+Tests@Example.com';
    const record = { ...member, email: queryEmail.toLowerCase() };
    const scope = search(api(), [{ ...member, email: 'other@example.com' }, record], queryEmail);
    await expect(findMemberByEmail(queryEmail)).resolves.toEqual(record);
    expect(scope.isDone()).toBe(true);
  });
  test('invites to every team as contributor and verifies the returned membership ID', async () => {
    const invited = { ...member, pending: true };
    let scope = search(api(), []);
    scope = scope
      .get(`${orgPath}/teams/`)
      .reply(200, teams)
      .post(membersPath, {
        email,
        orgRole: 'member',
        teamRoles: teams.map((t) => ({ teamSlug: t.slug, role: 'contributor' })),
        sendInvite: true,
      })
      .reply(201, invited);
    scope = search(scope, [invited]);
    await expect(inviteUser(email)).resolves.toEqual({
      ...invited,
      invitationId: member.id,
      teamsAssigned: 2,
    });
    expect(scope.isDone()).toBe(true);
  });
  test('sends an explicit organization role and an empty team list', async () => {
    let scope = search(api(), []);
    scope = scope
      .get(`${orgPath}/teams/`)
      .reply(200, [])
      .post(membersPath, { email, orgRole: 'admin', teamRoles: [], sendInvite: true })
      .reply(201, member);
    scope = search(scope, [member]);
    await expect(inviteUser(email, 'admin')).resolves.toMatchObject({
      invitationId: member.id,
      teamsAssigned: 0,
    });
    expect(scope.isDone()).toBe(true);
  });
  test.each([true, false])(
    'prevents an HTTP invitation when an existing member is pending=%s',
    async (pending) => {
      const scope = search(api(), [{ ...member, pending }]);
      await expect(inviteUser(email)).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
      });
      expect(scope.isDone()).toBe(true);
    },
  );
  test('maps a real Axios invitation validation response', async () => {
    let scope = search(api(), []);
    scope = scope
      .get(`${orgPath}/teams/`)
      .reply(200, [])
      .post(membersPath)
      .reply(400, { detail: 'Invalid data' });
    await expect(inviteUser(email)).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(scope.isDone()).toBe(true);
  });
  test('rejects an invitation that is missing during the verification request', async () => {
    let scope = search(api(), []);
    scope = scope.get(`${orgPath}/teams/`).reply(200, []).post(membersPath).reply(201, member);
    scope = search(scope, []);
    await expect(inviteUser(email)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
      message: expect.stringContaining('not found'),
    });
    expect(scope.isDone()).toBe(true);
  });
  test('removes all teams, tolerates an already absent team and verifies organization removal', async () => {
    let scope = beforeRemoval(teams)
      .delete(`${membersPath}42/teams/frontend/`)
      .reply(204)
      .delete(`${membersPath}42/teams/backend/`)
      .reply(404, { detail: 'Already absent' })
      .delete(`${membersPath}42/`)
      .reply(204);
    scope = search(scope, []);
    await expect(removeUser(` ${email} `)).resolves.toMatchObject({
      success: true,
      userEmail: email,
      memberId: '42',
      teamsRemoved: 2,
      totalTeams: 2,
    });
    expect(scope.isDone()).toBe(true);
  });
  test('stops before organization deletion if a team removal is forbidden', async () => {
    const scope = beforeRemoval([teams[0]])
      .delete(`${membersPath}42/teams/frontend/`)
      .reply(403, { detail: 'Denied' });
    await expect(removeUser(email)).rejects.toThrow('Failed to remove from team Frontend');
    expect(scope.isDone()).toBe(true);
  });
  test('does not report success if a deleted member remains in the organization', async () => {
    let scope = beforeRemoval().delete(`${membersPath}42/`).reply(204);
    scope = search(scope, [member]);
    await expect(removeUser(email)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
      message: expect.stringContaining('still exists'),
    });
    expect(scope.isDone()).toBe(true);
  });
  test('rejects removal if the member changes between the initial and verification searches', async () => {
    const scope = search(search(api(), [member]), [{ ...member, id: 'different' }]);
    await expect(removeUser(email)).rejects.toMatchObject({
      name: 'ProcessError',
      statusCode: 409,
    });
    expect(scope.isDone()).toBe(true);
  });
  test('maps organization removal authentication failures', async () => {
    const scope = beforeRemoval()
      .delete(`${membersPath}42/`)
      .reply(401, { detail: 'Unauthenticated' });
    await expect(removeUser(email)).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
    });
    expect(scope.isDone()).toBe(true);
  });
  test('combines a real member search response with detailed team slugs', async () => {
    const scope = search(api(), [member])
      .get(`${membersPath}42/`)
      .reply(200, { teams: ['frontend', 'backend'] });
    await expect(getUserDetails(email)).resolves.toEqual({
      email,
      name: member.name,
      organizationRole: 'member',
      status: 'active',
      memberSince: member.dateCreated,
      lastActive: member.dateCreated,
      teams: [{ name: '#frontend' }, { name: '#backend' }],
    });
    expect(scope.isDone()).toBe(true);
  });
  test('retains the profile with empty teams if the member-details endpoint fails', async () => {
    const scope = search(api(), [member])
      .get(`${membersPath}42/`)
      .reply(503, { detail: 'Unavailable' });
    await expect(getUserDetails(email)).resolves.toMatchObject({ email, teams: [] });
    expect(scope.isDone()).toBe(true);
  });
  test('preserves a member-search permission error rather than returning profile data', async () => {
    const scope = api().get(membersPath).query({ query: email }).reply(403, { detail: 'Denied' });
    await expect(getUserDetails(email)).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
    expect(scope.isDone()).toBe(true);
  });
});
