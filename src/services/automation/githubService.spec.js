jest.mock('axios', () => jest.fn());
jest.mock('dotenv', () => ({ config: jest.fn() }));

const originalToken = process.env.GITHUB_TOKEN;
const originalOrg = process.env.GITHUB_ORG_NAME;
process.env.GITHUB_TOKEN = 'test-only-token';
process.env.GITHUB_ORG_NAME = 'test-org';

const axios = require('axios');
const {
  checkUserMembership,
  getTeams,
  addUserToTeam,
  sendInvitation,
  removeUser,
  getUserDetails,
} = require('./githubService');

if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
else process.env.GITHUB_TOKEN = originalToken;
if (originalOrg === undefined) delete process.env.GITHUB_ORG_NAME;
else process.env.GITHUB_ORG_NAME = originalOrg;

const username = 'test-volunteer';
const orgUrl = 'https://api.github.com/orgs/test-org';
const membershipUrl = `${orgUrl}/memberships/${username}`;
const userUrl = `https://api.github.com/users/${username}`;
const expectedHeaders = {
  Authorization: 'Bearer test-only-token',
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'HGN-App/1.0',
};
const apiError = (status, message = 'GitHub request failed', headers = {}) =>
  Object.assign(new Error(message), { response: { status, headers } });
const commonFailures = [
  [401, 'UnauthorizedError', 401],
  [403, 'ForbiddenError', 403],
  [503, 'APIError', 500],
];
const allowedTeam = {
  id: 101,
  name: 'HGN',
  slug: 'highest-good-network-team',
  description: 'Development team',
  privacy: 'closed',
  internal: 'not exposed',
};

function prepareInvitation() {
  axios
    .mockResolvedValueOnce({ data: { id: 123 } })
    .mockRejectedValueOnce(apiError(404))
    .mockResolvedValueOnce({ status: 201 });
}

function prepareDetails(
  membership = { state: 'active', role: 'member' },
  profile = { name: 'Test User' },
) {
  axios.mockResolvedValueOnce({ data: { id: 123 } }).mockResolvedValueOnce({ data: profile });
  if (membership) axios.mockResolvedValueOnce({ data: membership });
  else axios.mockRejectedValueOnce(apiError(404));
}

beforeEach(() => axios.mockReset());

describe('GitHub membership checks', () => {
  test.each(['active', 'pending'])(
    'returns the %s membership and role with the configured organization headers',
    async (state) => {
      axios.mockResolvedValue({ data: { state, role: 'member', extra: 'not exposed' } });
      await expect(checkUserMembership(username)).resolves.toEqual({
        exists: true,
        state,
        role: 'member',
      });
      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: membershipUrl,
        headers: expectedHeaders,
      });
    },
  );

  test('treats 404 as an absent membership', async () => {
    axios.mockRejectedValue(apiError(404));
    await expect(checkUserMembership(username)).resolves.toEqual({
      exists: false,
      state: null,
      role: null,
    });
  });

  test.each(commonFailures)('maps a %s membership failure', async (status, name, statusCode) => {
    axios.mockRejectedValue(apiError(status));
    await expect(checkUserMembership(username)).rejects.toMatchObject({ name, statusCode });
  });

  test('reports a network failure instead of claiming the user is not a member', async () => {
    axios.mockRejectedValue(new Error('offline'));
    await expect(checkUserMembership(username)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
    });
  });
});

describe('GitHub team options', () => {
  test('exposes only the allowed team, its public fields and default selection', async () => {
    axios.mockResolvedValue({
      data: [
        { id: 999, name: 'Admins', slug: 'administrators' },
        allowedTeam,
        { id: 888, slug: 'highest-good-network-team-old' },
        { id: 777, slug: 'Highest-Good-Network-Team' },
      ],
    });
    await expect(getTeams()).resolves.toEqual([
      {
        id: 101,
        name: 'HGN',
        slug: 'highest-good-network-team',
        description: 'Development team',
        privacy: 'closed',
        isDefault: true,
      },
    ]);
    expect(axios).toHaveBeenCalledWith({
      method: 'GET',
      url: `${orgUrl}/teams`,
      headers: expectedHeaders,
    });
  });

  test.each([[[]], [[{ id: 999, slug: 'administrators' }]]])(
    'returns no options when no allowed team is present (%p)',
    async (data) => {
      axios.mockResolvedValue({ data });
      await expect(getTeams()).resolves.toEqual([]);
    },
  );

  test.each(commonFailures)('maps a %s team-list failure', async (status, name, statusCode) => {
    axios.mockRejectedValue(apiError(status));
    await expect(getTeams()).rejects.toMatchObject({ name, statusCode });
  });

  test('reports malformed team data instead of returning a successful empty list', async () => {
    axios.mockResolvedValue({ data: null });
    await expect(getTeams()).rejects.toMatchObject({ name: 'APIError', statusCode: 500 });
  });
});

describe('GitHub team membership changes', () => {
  test('defaults to member and sends the requested team membership', async () => {
    axios.mockResolvedValue({ status: 200 });
    await expect(addUserToTeam(username, allowedTeam.slug)).resolves.toBe(
      `User ${username} added to team ${allowedTeam.slug} as member`,
    );
    expect(axios).toHaveBeenCalledWith({
      method: 'PUT',
      url: `${orgUrl}/teams/${allowedTeam.slug}/memberships/${username}`,
      headers: expectedHeaders,
      data: { role: 'member' },
    });
  });

  test('preserves an explicitly requested maintainer role', async () => {
    axios.mockResolvedValue({ status: 200 });
    await expect(addUserToTeam(username, allowedTeam.slug, 'maintainer')).resolves.toContain(
      'as maintainer',
    );
    expect(axios.mock.calls[0][0].data).toEqual({ role: 'maintainer' });
  });

  test.each([201, 204])('rejects an unexpected %s team-update response', async (status) => {
    axios.mockResolvedValue({ status });
    await expect(addUserToTeam(username, allowedTeam.slug)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
      message: expect.stringContaining(`Unexpected response status: ${status}`),
    });
  });

  test.each([[404, 'NotFoundError', 404], ...commonFailures])(
    'maps a %s team-update failure',
    async (status, name, statusCode) => {
      axios.mockRejectedValue(apiError(status));
      await expect(addUserToTeam(username, allowedTeam.slug)).rejects.toMatchObject({
        name,
        statusCode,
      });
    },
  );

  test('maps a connection failure during team updates', async () => {
    axios.mockRejectedValue(new Error('offline'));
    await expect(addUserToTeam(username, allowedTeam.slug)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
    });
  });
});

describe('GitHub organization invitations', () => {
  test('looks up the user and membership before inviting with default role and no teams', async () => {
    prepareInvitation();
    await expect(sendInvitation(username)).resolves.toBe(
      `Invitation sent to ${username} with ID: 123`,
    );
    expect(axios.mock.calls.map(([request]) => request)).toEqual([
      { url: userUrl, headers: expectedHeaders },
      { method: 'GET', url: membershipUrl, headers: expectedHeaders },
      {
        method: 'POST',
        url: `${orgUrl}/invitations`,
        headers: expectedHeaders,
        data: { invitee_id: 123, role: 'direct_member', team_ids: [] },
      },
    ]);
  });

  test('includes explicit organization role and selected team IDs', async () => {
    prepareInvitation();
    await sendInvitation(username, 'billing_manager', [101, 202]);
    expect(axios).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { invitee_id: 123, role: 'billing_manager', team_ids: [101, 202] },
      }),
    );
  });

  test.each(['active', 'pending'])(
    'prevents a duplicate invitation for an existing %s membership',
    async (state) => {
      axios
        .mockResolvedValueOnce({ data: { id: 123 } })
        .mockResolvedValueOnce({ data: { state, role: 'member' } });
      await expect(sendInvitation(username)).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
      });
      expect(axios).toHaveBeenCalledTimes(2);
      expect(axios.mock.calls.some(([request]) => request.method === 'POST')).toBe(false);
    },
  );

  test.each([[404, 'NotFoundError', 404], ...commonFailures])(
    'stops without inviting when user lookup fails (%s)',
    async (status, name, statusCode) => {
      axios.mockRejectedValueOnce(apiError(status));
      await expect(sendInvitation(username)).rejects.toMatchObject({ name, statusCode });
      expect(axios).toHaveBeenCalledTimes(1);
    },
  );

  test('does not invite after a membership permission failure', async () => {
    axios.mockResolvedValueOnce({ data: { id: 123 } }).mockRejectedValueOnce(apiError(403));
    await expect(sendInvitation(username)).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
    });
    expect(axios).toHaveBeenCalledTimes(2);
  });

  test.each([[422, 'ValidationError', 422], ...commonFailures])(
    'maps an invitation endpoint failure (%s)',
    async (status, name, statusCode) => {
      axios
        .mockResolvedValueOnce({ data: { id: 123 } })
        .mockRejectedValueOnce(apiError(404))
        .mockRejectedValueOnce(apiError(status));
      await expect(sendInvitation(username)).rejects.toMatchObject({ name, statusCode });
    },
  );

  test('preserves an unexpected invitation response as an API error', async () => {
    axios
      .mockResolvedValueOnce({ data: { id: 123 } })
      .mockRejectedValueOnce(apiError(404))
      .mockResolvedValueOnce({ status: 200 });
    await expect(sendInvitation(username)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 500,
      message: 'Unexpected response status: 200',
    });
  });

  test('uses a readable fallback for an invitation error without a message', async () => {
    axios
      .mockResolvedValueOnce({ data: { id: 123 } })
      .mockRejectedValueOnce(apiError(404))
      .mockRejectedValueOnce({});
    await expect(sendInvitation(username)).rejects.toThrow('Unknown error occurred');
  });
});

describe('GitHub organization removal', () => {
  test('removes the exact user and reports success only after a 204 response', async () => {
    axios.mockResolvedValue({ status: 204 });
    await expect(removeUser(username)).resolves.toBe(
      `${username} has been successfully removed from the organization.`,
    );
    expect(axios).toHaveBeenCalledWith({
      method: 'DELETE',
      url: membershipUrl,
      headers: expectedHeaders,
    });
  });

  test('reports an unexpected successful HTTP response instead of claiming removal', async () => {
    axios.mockResolvedValue({ status: 200 });
    await expect(removeUser(username)).rejects.toMatchObject({ name: 'APIError', statusCode: 500 });
  });

  test.each([[404, 'NotFoundError', 404], ...commonFailures])(
    'maps a %s removal failure',
    async (status, name, statusCode) => {
      axios.mockRejectedValue(apiError(status));
      await expect(removeUser(username)).rejects.toMatchObject({ name, statusCode });
    },
  );

  test('preserves an existing typed error', async () => {
    const error = Object.assign(new Error('custom'), { statusCode: 418 });
    axios.mockRejectedValue(error);
    await expect(removeUser(username)).rejects.toBe(error);
  });

  test('provides a fallback for removal failure without an error message', async () => {
    axios.mockRejectedValue({});
    await expect(removeUser(username)).rejects.toThrow('Unknown error occurred');
  });
});

describe('GitHub user details', () => {
  test.each([undefined, null, '', '  ', 42])(
    'rejects invalid username %p before any API request',
    async (input) => {
      await expect(getUserDetails(input)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
      expect(axios).not.toHaveBeenCalled();
    },
  );

  test('combines profile, membership and direct team names', async () => {
    prepareDetails();
    axios.mockResolvedValueOnce({ data: [{ name: 'HGN' }, { name: 'Other Team' }] });
    await expect(getUserDetails(username)).resolves.toEqual({
      name: 'Test User',
      organizationRole: 'member',
      status: 'active',
      teams: ['HGN', 'Other Team'],
    });
    expect(axios.mock.calls.map(([request]) => request.url)).toEqual([
      userUrl,
      'https://api.github.com/user/123',
      membershipUrl,
      `${orgUrl}/members/${username}/teams`,
    ]);
    expect(
      axios.mock.calls.every(
        ([request]) => JSON.stringify(request.headers) === JSON.stringify(expectedHeaders),
      ),
    ).toBe(true);
  });

  test('does not fetch teams for a pending invitation', async () => {
    prepareDetails({ state: 'pending', role: 'member' });
    await expect(getUserDetails(username)).resolves.toEqual({
      name: 'Test User',
      organizationRole: 'member',
      status: 'pending',
      teams: [],
    });
    expect(axios).toHaveBeenCalledTimes(3);
  });

  test('supplies profile defaults for someone who is not a member', async () => {
    prepareDetails(null, { name: null });
    await expect(getUserDetails(username)).resolves.toEqual({
      name: 'Not set',
      organizationRole: 'Not a member',
      status: 'Not invited',
      teams: [],
    });
    expect(axios).toHaveBeenCalledTimes(3);
  });

  test('falls back to per-team membership checks and omits non-memberships', async () => {
    prepareDetails();
    axios
      .mockRejectedValueOnce(apiError(404))
      .mockResolvedValueOnce({
        data: [
          { slug: 'hgn', name: 'HGN' },
          { slug: 'admin', name: 'Admin' },
        ],
      })
      .mockResolvedValueOnce({ status: 204 })
      .mockRejectedValueOnce(apiError(404));
    await expect(getUserDetails(username)).resolves.toMatchObject({ teams: ['HGN'] });
    expect(axios.mock.calls.slice(-2).map(([request]) => request.url)).toEqual([
      `${orgUrl}/teams/hgn/members/${username}`,
      `${orgUrl}/teams/admin/members/${username}`,
    ]);
  });

  test('keeps profile and membership details when both team lookup methods fail', async () => {
    prepareDetails();
    axios.mockRejectedValueOnce(apiError(404)).mockRejectedValueOnce(apiError(403));
    await expect(getUserDetails(username)).resolves.toEqual({
      name: 'Test User',
      organizationRole: 'member',
      status: 'active',
      teams: [],
    });
  });

  test('handles an empty organization team list during fallback', async () => {
    prepareDetails();
    axios.mockRejectedValueOnce(apiError(404)).mockResolvedValueOnce({ data: [] });
    await expect(getUserDetails(username)).resolves.toMatchObject({ teams: [] });
  });

  test('propagates a typed user lookup error', async () => {
    axios.mockRejectedValueOnce(apiError(404));
    await expect(getUserDetails(username)).rejects.toMatchObject({
      name: 'NotFoundError',
      statusCode: 404,
    });
    expect(axios).toHaveBeenCalledTimes(1);
  });

  test.each([
    [Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }), 'NetworkError', 503],
    [Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' }), 'NetworkError', 503],
    [Object.assign(new Error('aborted'), { code: 'ECONNABORTED' }), 'TimeoutError', 408],
    [new Error('request timeout'), 'TimeoutError', 408],
    [apiError(404), 'NotFoundError', 404],
    [apiError(403), 'ForbiddenError', 403],
    [apiError(401), 'UnauthorizedError', 401],
    [apiError(422), 'ValidationError', 422],
    [apiError(503), 'ServerError', 503],
    [apiError(429), 'APIError', 429],
    [new Error('unexpected'), 'APIError', 500],
  ])('maps profile lookup failures (%p)', async (error, name, statusCode) => {
    axios.mockResolvedValueOnce({ data: { id: 123 } }).mockRejectedValueOnce(error);
    await expect(getUserDetails(username)).rejects.toMatchObject({ name, statusCode });
  });

  test('includes the rate-limit reset time in permission errors when supplied', async () => {
    axios
      .mockResolvedValueOnce({ data: { id: 123 } })
      .mockRejectedValueOnce(apiError(403, 'rate limit', { 'x-ratelimit-reset': '1795550400' }));
    await expect(getUserDetails(username)).rejects.toMatchObject({
      name: 'ForbiddenError',
      message: expect.stringContaining(new Date(1795550400 * 1000).toLocaleTimeString()),
    });
  });

  test('preserves membership failures instead of returning an invented membership', async () => {
    axios
      .mockResolvedValueOnce({ data: { id: 123 } })
      .mockResolvedValueOnce({ data: { name: 'Test User' } })
      .mockRejectedValueOnce(apiError(401));
    await expect(getUserDetails(username)).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
    });
  });
});
