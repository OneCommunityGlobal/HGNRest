jest.mock('axios', () => jest.fn());
jest.mock('dotenv', () => ({ config: jest.fn() }));

const originalToken = process.env.SENTRY_API_TOKEN;
const originalOrg = process.env.SENTRY_ORG_SLUG;
process.env.SENTRY_API_TOKEN = 'test-only-token';
process.env.SENTRY_ORG_SLUG = 'test-org';

const axios = require('axios');
const {
  getTeams,
  findMemberByEmail,
  checkUserExists,
  verifyInvitation,
  verifyRemoval,
  inviteUser,
  removeUserFromAllTeams,
  removeUser,
  getUserDetails,
} = require('./sentryService');

if (originalToken === undefined) delete process.env.SENTRY_API_TOKEN;
else process.env.SENTRY_API_TOKEN = originalToken;
if (originalOrg === undefined) delete process.env.SENTRY_ORG_SLUG;
else process.env.SENTRY_ORG_SLUG = originalOrg;

const email = 'volunteer@example.com';
const orgUrl = 'https://sentry.io/api/0/organizations/test-org';
const searchUrl = `${orgUrl}/members/?query=${encodeURIComponent(email)}`;
const headers = { Authorization: 'Bearer test-only-token', 'Content-Type': 'application/json' };
const member = {
  id: '42',
  email,
  name: 'Test Volunteer',
  pending: false,
  orgRole: 'member',
  dateCreated: '2026-11-01T00:00:00Z',
};
const teams = [
  { slug: 'frontend', name: 'Frontend' },
  { slug: 'backend', name: 'Backend' },
];
const apiError = (status, message = 'API failed') =>
  Object.assign(new Error(message), { response: { status } });
const typedError = () =>
  Object.assign(new Error('Existing typed error'), { name: 'ProcessError', statusCode: 502 });
const searchResult = (members) => ({ data: members });

beforeEach(() => axios.mockReset());

function invitationReady(selectedTeams = teams) {
  axios.mockResolvedValueOnce(searchResult([])).mockResolvedValueOnce({ data: selectedTeams });
}
function removalReady(selectedTeams = []) {
  axios
    .mockResolvedValueOnce(searchResult([member]))
    .mockResolvedValueOnce(searchResult([member]))
    .mockResolvedValueOnce({ data: selectedTeams });
}

describe('Sentry team discovery', () => {
  test('returns the team response using the configured organization and headers', async () => {
    axios.mockResolvedValueOnce({ data: teams });
    await expect(getTeams()).resolves.toEqual(teams);
    expect(axios).toHaveBeenCalledWith({ url: `${orgUrl}/teams/`, method: 'GET', headers });
  });
  test('accepts an organization with no teams', async () => {
    axios.mockResolvedValueOnce({ data: [] });
    await expect(getTeams()).resolves.toEqual([]);
  });
  test.each([
    [403, 'ForbiddenError'],
    [401, 'UnauthorizedError'],
    [404, 'NotFoundError'],
    [429, 'APIError'],
    [503, 'APIError'],
  ])('maps team lookup HTTP %s', async (status, name) => {
    axios.mockRejectedValueOnce(apiError(status));
    await expect(getTeams()).rejects.toMatchObject({ name, statusCode: status });
  });
  test('maps a network failure to a readable API error', async () => {
    axios.mockRejectedValueOnce(new Error('connection lost'));
    await expect(getTeams()).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
      message: expect.stringContaining('connection lost'),
    });
  });
});

describe('Sentry member search and existence', () => {
  test.each([undefined, null, '', '   ', 42, {}])(
    'rejects invalid search email %p without HTTP',
    async (value) => {
      await expect(findMemberByEmail(value)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
      expect(axios).not.toHaveBeenCalled();
    },
  );
  test('URL-encodes the query and finds an exact case-insensitive email match', async () => {
    const query = 'Volunteer+Tests@Example.com';
    const match = { ...member, email: query.toLowerCase() };
    axios.mockResolvedValueOnce(searchResult([{ ...member, email: 'other@example.com' }, match]));
    await expect(findMemberByEmail(query)).resolves.toEqual(match);
    expect(axios).toHaveBeenCalledWith({
      url: `${orgUrl}/members/?query=Volunteer%2BTests%40Example.com`,
      headers,
    });
  });
  test.each([[[]], [[{ ...member, email: 'another@example.com' }]]])(
    'does not mistake a search result for an exact email match (%p)',
    async (members) => {
      axios.mockResolvedValueOnce(searchResult(members));
      await expect(findMemberByEmail(email)).resolves.toBeUndefined();
    },
  );
  test.each([
    [403, 'ForbiddenError'],
    [401, 'UnauthorizedError'],
    [404, 'APIError'],
    [500, 'APIError'],
  ])('maps search HTTP %s', async (status, name) => {
    axios.mockRejectedValueOnce(apiError(status));
    await expect(findMemberByEmail(email)).rejects.toMatchObject({ name, statusCode: status });
  });
  test('does not report absence after a search network failure', async () => {
    axios.mockRejectedValueOnce(new Error('offline'));
    await expect(checkUserExists(email)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
    });
  });
  test.each([false, true])('reports pending=%s with the member record', async (pending) => {
    const record = { ...member, pending };
    axios.mockResolvedValueOnce(searchResult([record]));
    await expect(checkUserExists(email)).resolves.toEqual({
      exists: true,
      member: record,
      status: pending ? 'pending' : 'active',
    });
  });
  test('reports an absent member explicitly', async () => {
    axios.mockResolvedValueOnce(searchResult([]));
    await expect(checkUserExists(email)).resolves.toEqual({
      exists: false,
      member: null,
      status: null,
    });
  });
});

describe('Sentry invitation and removal verification', () => {
  test.each([false, true])(
    'verifies an invitation by exact member ID (pending=%s)',
    async (pending) => {
      const record = { ...member, pending };
      axios.mockResolvedValueOnce(searchResult([record]));
      await expect(verifyInvitation(email, member.id)).resolves.toEqual({
        verified: true,
        member: record,
        status: pending ? 'pending' : 'active',
      });
    },
  );
  test('rejects an invitation that is absent from the organization', async () => {
    axios.mockResolvedValueOnce(searchResult([]));
    await expect(verifyInvitation(email, member.id)).rejects.toThrow(
      'not found in organization members',
    );
  });
  test('rejects a different member ID instead of claiming verification', async () => {
    axios.mockResolvedValueOnce(searchResult([member]));
    await expect(verifyInvitation(email, 'different')).rejects.toThrow('Member ID mismatch');
  });
  test('reports failed invitation verification when lookup is unavailable', async () => {
    axios.mockRejectedValueOnce(apiError(403));
    await expect(verifyInvitation(email, member.id)).rejects.toThrow(
      'Invitation verification failed',
    );
  });
  test('verifies removal only when the member is absent', async () => {
    axios.mockResolvedValueOnce(searchResult([]));
    await expect(verifyRemoval(email)).resolves.toEqual({ verified: true });
  });
  test('rejects removal verification when the member is still present', async () => {
    axios.mockResolvedValueOnce(searchResult([member]));
    await expect(verifyRemoval(email)).rejects.toThrow('still exists in organization');
  });
  test('does not treat a failed member lookup as verified removal', async () => {
    axios.mockRejectedValueOnce(apiError(401));
    await expect(verifyRemoval(email)).rejects.toThrow('Removal verification failed');
  });
});

describe('Sentry invitations', () => {
  test.each([undefined, null, '', ' ', 42, {}])(
    'rejects invalid email %p before lookup',
    async (value) => {
      await expect(inviteUser(value)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
      expect(axios).not.toHaveBeenCalled();
    },
  );
  test.each([null, '', ' ', 42, {}])('rejects invalid role %p before lookup', async (role) => {
    await expect(inviteUser(email, role)).rejects.toMatchObject({
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(axios).not.toHaveBeenCalled();
  });
  test.each(['invalid', 'volunteer@', '@example.com', 'a b@example.com'])(
    'rejects malformed email %s',
    async (value) => {
      await expect(inviteUser(value)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
      expect(axios).not.toHaveBeenCalled();
    },
  );
  test.each([true, false])(
    'prevents duplicate invitations for pending=%s members',
    async (pending) => {
      axios.mockResolvedValueOnce(searchResult([{ ...member, pending }]));
      await expect(inviteUser(email)).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
        message: expect.stringContaining(pending ? 'pending invitation' : 'active member'),
      });
      expect(axios).toHaveBeenCalledTimes(1);
    },
  );
  test('invites with member role, assigns every team as contributor and verifies the created ID', async () => {
    invitationReady();
    const invited = { ...member, pending: true };
    axios.mockResolvedValueOnce({ data: invited }).mockResolvedValueOnce(searchResult([invited]));
    await expect(inviteUser(email)).resolves.toEqual({
      ...invited,
      teamsAssigned: 2,
      invitationId: member.id,
    });
    expect(axios.mock.calls.map(([c]) => c.url)).toEqual([
      searchUrl,
      `${orgUrl}/teams/`,
      `${orgUrl}/members/`,
      searchUrl,
    ]);
    expect(axios).toHaveBeenNthCalledWith(3, {
      url: `${orgUrl}/members/`,
      method: 'POST',
      headers,
      data: {
        email,
        orgRole: 'member',
        teamRoles: teams.map((t) => ({ teamSlug: t.slug, role: 'contributor' })),
        sendInvite: true,
      },
    });
  });
  test('preserves an explicitly selected role and supports no teams', async () => {
    invitationReady([]);
    axios.mockResolvedValueOnce({ data: member }).mockResolvedValueOnce(searchResult([member]));
    await expect(inviteUser(email, 'admin')).resolves.toMatchObject({
      teamsAssigned: 0,
      invitationId: member.id,
    });
    expect(axios.mock.calls[2][0].data).toEqual({
      email,
      orgRole: 'admin',
      teamRoles: [],
      sendInvite: true,
    });
  });
  test('does not invite when the pre-invitation search fails', async () => {
    axios.mockRejectedValueOnce(apiError(403));
    await expect(inviteUser(email)).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test('does not invite when team discovery fails', async () => {
    axios.mockResolvedValueOnce(searchResult([])).mockRejectedValueOnce(apiError(401));
    await expect(inviteUser(email)).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
    });
    expect(axios).toHaveBeenCalledTimes(2);
  });
  test.each([undefined, null, {}])(
    'rejects invitation responses without an ID (%p)',
    async (data) => {
      invitationReady();
      axios.mockResolvedValueOnce({ data });
      await expect(inviteUser(email)).rejects.toMatchObject({
        name: 'ProcessError',
        statusCode: 500,
      });
      expect(axios).toHaveBeenCalledTimes(3);
    },
  );
  test('does not report successful invitation when the verification ID differs', async () => {
    invitationReady();
    axios
      .mockResolvedValueOnce({ data: { id: 'new-id' } })
      .mockResolvedValueOnce(searchResult([member]));
    await expect(inviteUser(email)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
      message: expect.stringContaining('Member ID mismatch'),
    });
  });
  test.each([
    [400, 'ValidationError'],
    [403, 'ForbiddenError'],
    [401, 'UnauthorizedError'],
    [409, 'ConflictError'],
    [429, 'APIError'],
    [503, 'APIError'],
  ])('maps invitation HTTP %s', async (status, name) => {
    invitationReady();
    axios.mockRejectedValueOnce(apiError(status));
    await expect(inviteUser(email)).rejects.toMatchObject({ name, statusCode: status });
  });
  test('preserves a typed invitation error', async () => {
    invitationReady();
    const error = typedError();
    axios.mockRejectedValueOnce(error);
    await expect(inviteUser(email)).rejects.toBe(error);
  });
  test('reports invitation transport failure', async () => {
    invitationReady();
    axios.mockRejectedValueOnce(new Error('offline'));
    await expect(inviteUser(email)).rejects.toMatchObject({ name: 'APIError', statusCode: 500 });
  });
});

describe('Sentry team removal', () => {
  test('returns zero counts without DELETE when no teams exist', async () => {
    axios.mockResolvedValueOnce({ data: [] });
    await expect(removeUserFromAllTeams(member.id)).resolves.toEqual({
      removedFrom: 0,
      totalTeams: 0,
    });
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test('removes from every exact team endpoint before reporting counts', async () => {
    axios
      .mockResolvedValueOnce({ data: teams })
      .mockResolvedValueOnce({ status: 204 })
      .mockResolvedValueOnce({ status: 204 });
    await expect(removeUserFromAllTeams(member.id)).resolves.toEqual({
      removedFrom: 2,
      totalTeams: 2,
      success: true,
    });
    teams.forEach((team, i) => {
      expect(axios).toHaveBeenNthCalledWith(i + 2, {
        url: `${orgUrl}/members/42/teams/${team.slug}/`,
        method: 'DELETE',
        headers,
      });
    });
  });
  test('treats an already absent team membership as successfully removed', async () => {
    axios
      .mockResolvedValueOnce({ data: teams })
      .mockRejectedValueOnce(apiError(404))
      .mockResolvedValueOnce({ status: 204 });
    await expect(removeUserFromAllTeams(member.id)).resolves.toEqual({
      removedFrom: 2,
      totalTeams: 2,
      success: true,
    });
  });
  test('reports the failed team even when another team removal succeeds', async () => {
    axios
      .mockResolvedValueOnce({ data: teams })
      .mockRejectedValueOnce(apiError(403, 'denied'))
      .mockResolvedValueOnce({ status: 204 });
    await expect(removeUserFromAllTeams(member.id)).rejects.toThrow(
      'Failed to remove from team Frontend: denied',
    );
    expect(axios).toHaveBeenCalledTimes(3);
  });
  test('reports a team deletion network error', async () => {
    axios.mockResolvedValueOnce({ data: [teams[0]] }).mockRejectedValueOnce(new Error('offline'));
    await expect(removeUserFromAllTeams(member.id)).rejects.toThrow('offline');
  });
  test('reports team discovery errors', async () => {
    axios.mockRejectedValueOnce(apiError(401));
    await expect(removeUserFromAllTeams(member.id)).rejects.toThrow(
      'Error removing user from teams',
    );
  });
});

describe('Sentry organization removal', () => {
  test.each([undefined, null, '', ' ', 'invalid', 'a@b'])(
    'rejects invalid removal email %p without HTTP',
    async (value) => {
      await expect(removeUser(value)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
      expect(axios).not.toHaveBeenCalled();
    },
  );
  test('trims the email, removes teams then organization, and verifies absence', async () => {
    removalReady(teams);
    axios
      .mockResolvedValueOnce({ status: 204 })
      .mockResolvedValueOnce({ status: 204 })
      .mockResolvedValueOnce({ status: 204 })
      .mockResolvedValueOnce(searchResult([]));
    await expect(removeUser(`  ${email}  `)).resolves.toEqual({
      success: true,
      message: `Successfully removed user from organization and 2 teams: ${email}`,
      userEmail: email,
      memberId: '42',
      teamsRemoved: 2,
      totalTeams: 2,
    });
    expect(axios.mock.calls.map(([c]) => c.url)).toEqual([
      searchUrl,
      searchUrl,
      `${orgUrl}/teams/`,
      `${orgUrl}/members/42/teams/frontend/`,
      `${orgUrl}/members/42/teams/backend/`,
      `${orgUrl}/members/42/`,
      searchUrl,
    ]);
    expect(axios).toHaveBeenNthCalledWith(6, {
      url: `${orgUrl}/members/42/`,
      method: 'DELETE',
      headers,
    });
  });
  test('supports removal with no team memberships', async () => {
    removalReady();
    axios.mockResolvedValueOnce({ status: 204 }).mockResolvedValueOnce(searchResult([]));
    await expect(removeUser(email)).resolves.toMatchObject({
      success: true,
      teamsRemoved: 0,
      totalTeams: 0,
    });
  });
  test('returns not found without deleting an absent member', async () => {
    axios.mockResolvedValueOnce(searchResult([]));
    await expect(removeUser(email)).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test.each([[[]], [[{ ...member, id: 'changed-id' }]]])(
    'stops if the member disappears or changes before removal (%p)',
    async (records) => {
      axios
        .mockResolvedValueOnce(searchResult([member]))
        .mockResolvedValueOnce(searchResult(records));
      await expect(removeUser(email)).rejects.toMatchObject({
        name: 'ProcessError',
        statusCode: 409,
      });
      expect(axios).toHaveBeenCalledTimes(2);
    },
  );
  test('preserves typed errors during the pre-removal verification', async () => {
    axios.mockResolvedValueOnce(searchResult([member])).mockRejectedValueOnce(apiError(403));
    await expect(removeUser(email)).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
    expect(axios).toHaveBeenCalledTimes(2);
  });
  test('does not delete organization membership if team removal fails', async () => {
    removalReady([teams[0]]);
    axios.mockRejectedValueOnce(apiError(403));
    await expect(removeUser(email)).rejects.toThrow('Failed to remove from teams');
    expect(
      axios.mock.calls.some(([c]) => c.method === 'DELETE' && c.url === `${orgUrl}/members/42/`),
    ).toBe(false);
  });
  test('rejects success when the member is still present after DELETE', async () => {
    removalReady();
    axios.mockResolvedValueOnce({ status: 204 }).mockResolvedValueOnce(searchResult([member]));
    await expect(removeUser(email)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
      message: expect.stringContaining('still exists'),
    });
  });
  test.each([
    [404, 'NotFoundError'],
    [403, 'ForbiddenError'],
    [401, 'UnauthorizedError'],
    [429, 'APIError'],
    [503, 'APIError'],
  ])('maps organization deletion HTTP %s', async (status, name) => {
    removalReady();
    axios.mockRejectedValueOnce(apiError(status));
    await expect(removeUser(email)).rejects.toMatchObject({ name, statusCode: status });
  });
  test('preserves a typed organization deletion error', async () => {
    removalReady();
    const error = typedError();
    axios.mockRejectedValueOnce(error);
    await expect(removeUser(email)).rejects.toBe(error);
  });
  test('reports organization deletion network errors', async () => {
    removalReady();
    axios.mockRejectedValueOnce(new Error('offline'));
    await expect(removeUser(email)).rejects.toMatchObject({ name: 'APIError', statusCode: 500 });
  });
});

describe('Sentry user details', () => {
  test.each([undefined, null, '', ' ', 42, {}])(
    'rejects invalid details email %p before HTTP',
    async (value) => {
      await expect(getUserDetails(value)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
      expect(axios).not.toHaveBeenCalled();
    },
  );
  test('combines profile, activity and hash-prefixed team names', async () => {
    const record = { ...member, user: { lastActive: '2026-11-20T00:00:00Z' } };
    axios
      .mockResolvedValueOnce(searchResult([record]))
      .mockResolvedValueOnce({ data: { teams: ['frontend', 'backend'] } });
    await expect(getUserDetails(email)).resolves.toEqual({
      email,
      name: member.name,
      organizationRole: 'member',
      status: 'active',
      memberSince: member.dateCreated,
      lastActive: record.user.lastActive,
      teams: [{ name: '#frontend' }, { name: '#backend' }],
    });
    expect(axios).toHaveBeenNthCalledWith(2, {
      url: `${orgUrl}/members/42/`,
      method: 'GET',
      headers,
    });
  });
  test.each([undefined, []])(
    'provides defaults and pending state when teams are %p',
    async (memberTeams) => {
      const record = { ...member, name: '', orgRole: '', pending: true };
      axios
        .mockResolvedValueOnce(searchResult([record]))
        .mockResolvedValueOnce({ data: { teams: memberTeams } });
      await expect(getUserDetails(email)).resolves.toEqual({
        email,
        name: 'Not set',
        organizationRole: 'member',
        status: 'pending',
        memberSince: member.dateCreated,
        lastActive: member.dateCreated,
        teams: [],
      });
    },
  );
  test('falls back to creation time when nested activity is absent', async () => {
    axios
      .mockResolvedValueOnce(searchResult([{ ...member, user: {} }]))
      .mockResolvedValueOnce({ data: { teams: [] } });
    await expect(getUserDetails(email)).resolves.toMatchObject({ lastActive: member.dateCreated });
  });
  test('preserves the profile and falls back to empty teams if member-details lookup fails', async () => {
    axios.mockResolvedValueOnce(searchResult([member])).mockRejectedValueOnce(apiError(403));
    await expect(getUserDetails(email)).resolves.toMatchObject({
      email,
      name: member.name,
      teams: [],
    });
  });
  test('returns a typed not-found error if no member matches', async () => {
    axios.mockResolvedValueOnce(searchResult([]));
    await expect(getUserDetails(email)).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
    expect(axios).toHaveBeenCalledTimes(1);
  });
  test.each([
    [401, 'UnauthorizedError'],
    [403, 'ForbiddenError'],
    [404, 'APIError'],
    [429, 'APIError'],
    [503, 'APIError'],
  ])('preserves the member-search error for HTTP %s', async (status, name) => {
    axios.mockRejectedValueOnce(apiError(status));
    await expect(getUserDetails(email)).rejects.toMatchObject({ name, statusCode: status });
  });
  test('reports search transport errors without inventing profile details', async () => {
    axios.mockRejectedValueOnce(new Error('offline'));
    await expect(getUserDetails(email)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
    });
  });
});
