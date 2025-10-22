const axios = require('axios');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN;
const orgName = process.env.GITHUB_ORG_NAME;

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'HGN-App/1.0',
};

const getUserIdUrl = (username) => `https://api.github.com/users/${username}`;
const sendInvitationUrl = (org) => `https://api.github.com/orgs/${org}/invitations`;
const removeUserUrl = (org, username) =>
  `https://api.github.com/orgs/${org}/memberships/${username}`;
const checkMembershipUrl = (org, username) =>
  `https://api.github.com/orgs/${org}/memberships/${username}`;
const getTeamsUrl = (org) => `https://api.github.com/orgs/${org}/teams`;
const addTeamMemberUrl = (org, teamSlug, username) =>
  `https://api.github.com/orgs/${org}/teams/${teamSlug}/memberships/${username}`;

// Service to fetch GitHub user ID by username
async function getUserId(username) {
  try {
    const response = await axios({
      url: getUserIdUrl(username),
      headers,
    });
    return response.data.id;
  } catch (error) {
    if (error.response?.status === 404) {
      const notFoundError = new Error(`GitHub user '${username}' not found`);
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'GitHub API access forbidden - check token permissions or rate limits',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('GitHub API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    const apiError = new Error(`GitHub API error fetching user: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = 500;
    throw apiError;
  }
}

// Service to check if user is already a member or has pending invitation
async function checkUserMembership(username) {
  try {
    const response = await axios({
      method: 'GET',
      url: checkMembershipUrl(orgName, username),
      headers,
    });

    // If we get a response, user has some relationship with the org
    return {
      exists: true,
      state: response.data.state, // 'active', 'pending', etc.
      role: response.data.role,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      // User is not a member and has no pending invitation
      return { exists: false, state: null, role: null };
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error('GitHub API access forbidden - check token permissions');
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('GitHub API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    const apiError = new Error(`GitHub API error checking membership: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = 500;
    throw apiError;
  }
}

// Service to get all teams in the organization
async function getTeams() {
  try {
    const response = await axios({
      method: 'GET',
      url: getTeamsUrl(orgName),
      headers,
    });

    return response.data.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      privacy: team.privacy,
    }));
  } catch (error) {
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'GitHub API access forbidden - check token permissions for teams',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('GitHub API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    const apiError = new Error(`GitHub API error fetching teams: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = 500;
    throw apiError;
  }
}

// Service to add a user to a specific team
async function addUserToTeam(username, teamSlug, role = 'member') {
  try {
    const payload = { role };
    const response = await axios({
      method: 'PUT',
      url: addTeamMemberUrl(orgName, teamSlug, username),
      headers,
      data: payload,
    });

    if (response.status === 200) {
      return `User ${username} added to team ${teamSlug} as ${role}`;
    }
    const unexpectedError = new Error(`Unexpected response status: ${response.status}`);
    unexpectedError.name = 'APIError';
    unexpectedError.statusCode = 500;
    throw unexpectedError;
  } catch (error) {
    if (error.response?.status === 404) {
      const notFoundError = new Error(
        `Team '${teamSlug}' not found or user '${username}' not found`,
      );
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'GitHub API access forbidden - check token permissions for team management',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('GitHub API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    const apiError = new Error(`GitHub API error adding user to team: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = 500;
    throw apiError;
  }
}

// Service to send an invitation to a user to join the organization
async function sendInvitation(username, orgRole = 'direct_member', teamIds = []) {
  try {
    // First, check if user exists on GitHub
    const userId = await getUserId(username);

    // Check if user is already a member or has pending invitation
    const membership = await checkUserMembership(username);
    if (membership.exists) {
      if (membership.state === 'active') {
        const conflictError = new Error(
          `User '${username}' is already an active member of the organization`,
        );
        conflictError.name = 'ConflictError';
        conflictError.statusCode = 409;
        throw conflictError;
      } else if (membership.state === 'pending') {
        const conflictError = new Error(`User '${username}' already has a pending invitation`);
        conflictError.name = 'ConflictError';
        conflictError.statusCode = 409;
        throw conflictError;
      }
    }

    // Send the invitation with role and teams
    const payload = {
      invitee_id: userId,
      role: orgRole,
      team_ids: teamIds,
    };
    const response = await axios({
      method: 'POST',
      url: sendInvitationUrl(orgName),
      headers,
      data: payload,
    });

    if (response.status === 201) {
      return `Invitation sent to ${username} with ID: ${userId}`;
    }
    const unexpectedError = new Error(`Unexpected response status: ${response.status}`);
    unexpectedError.name = 'APIError';
    unexpectedError.statusCode = 500;
    throw unexpectedError;
  } catch (error) {
    // If it's already our custom error with proper properties, re-throw it
    if (error.name && error.statusCode) {
      throw error;
    }

    // Handle GitHub API specific errors
    if (error.response?.status === 422) {
      const validationError = new Error(
        `User '${username}' cannot be invited - they may not be found, or your account lacks permission to invite them.`,
      );
      validationError.name = 'ValidationError';
      validationError.statusCode = 422;
      throw validationError;
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'GitHub API access forbidden - check token permissions for organization invitations or rate limits',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('GitHub API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }

    const apiError = new Error(
      `GitHub API error sending invitation: ${error.message || 'Unknown error occurred'}`,
    );
    apiError.name = 'APIError';
    apiError.statusCode = 500;
    throw apiError;
  }
}

// Service to remove a user from the GitHub organization
async function removeUser(username) {
  try {
    const response = await axios({
      method: 'DELETE',
      url: removeUserUrl(orgName, username),
      headers,
    });

    if (response.status === 204) {
      return `${username} has been successfully removed from the organization.`;
    }
    const unexpectedError = new Error(`Unexpected response status: ${response.status}`);
    unexpectedError.name = 'APIError';
    unexpectedError.statusCode = 500;
    throw unexpectedError;
  } catch (error) {
    // If it's already our custom error with proper properties, re-throw it
    if (error.name && error.statusCode) {
      throw error;
    }

    // Handle GitHub API specific errors
    if (error.response?.status === 404) {
      const notFoundError = new Error(
        `User '${username}' is not a member of the organization or does not exist`,
      );
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'GitHub API access forbidden - check token permissions for organization management or rate limits',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('GitHub API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }

    const apiError = new Error(
      `GitHub API error removing user: ${error.message || 'Unknown error occurred'}`,
    );
    apiError.name = 'APIError';
    apiError.statusCode = 500;
    throw apiError;
  }
}

// Get detailed user information including organization membership
async function getUserDetails(username) {
  try {
    // Input validation
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      const validationError = new Error('Username is required and must be a non-empty string');
      validationError.name = 'ValidationError';
      validationError.statusCode = 400;
      throw validationError;
    }

    // Get basic user info
    const userId = await getUserId(username);
    const userResponse = await axios({
      method: 'GET',
      url: `https://api.github.com/user/${userId}`,
      headers,
    });

    // Get organization membership info
    const membership = await checkUserMembership(username);

    // Get user team memberships
    let userTeams = [];

    // Only try to get teams if user is an active member
    if (membership.exists && membership.state === 'active') {
      try {
        const teamsResponse = await axios({
          method: 'GET',
          url: `https://api.github.com/orgs/${orgName}/members/${username}/teams`,
          headers,
        });

        userTeams = teamsResponse.data.map((team) => team.name);
      } catch (teamsError) {
        // If the direct endpoint fails, try an alternative approach
        try {
          // Get all teams in the organization
          const allTeamsResponse = await axios({
            method: 'GET',
            url: `https://api.github.com/orgs/${orgName}/teams`,
            headers,
          });

          // Check each team for user membership
          const userTeamsPromises = allTeamsResponse.data.map(async (team) => {
            try {
              await axios({
                method: 'GET',
                url: `https://api.github.com/orgs/${orgName}/teams/${team.slug}/members/${username}`,
                headers,
              });

              // If we get here, user is a member of this team
              return team.name;
            } catch (memberError) {
              // User is not a member of this team
              return null;
            }
          });

          const teamResults = await Promise.all(userTeamsPromises);
          userTeams = teamResults.filter((team) => team !== null);
        } catch (alternativeError) {
          userTeams = [];
        }
      }
    } else {
      // User is not an active member, so no teams
      userTeams = [];
    }

    const userDetails = {
      name: userResponse.data.name || 'Not set',
      organizationRole: membership.exists ? membership.role : 'Not a member',
      status: membership.exists ? membership.state : 'Not invited',
      teams: userTeams,
    };

    return userDetails;
  } catch (error) {
    // If it's already our custom error with proper properties, re-throw it
    if (error.name && error.statusCode) {
      throw error;
    }

    // Handle network/connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const networkError = new Error(
        'Unable to connect to GitHub API - please check your internet connection',
      );
      networkError.name = 'NetworkError';
      networkError.statusCode = 503;
      throw networkError;
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const timeoutError = new Error('GitHub API request timed out - please try again');
      timeoutError.name = 'TimeoutError';
      timeoutError.statusCode = 408;
      throw timeoutError;
    }

    // Handle GitHub API specific errors
    if (error.response?.status === 404) {
      const notFoundError = new Error(`GitHub user '${username}' not found or does not exist`);
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    if (error.response?.status === 403) {
      const rateLimitReset = error.response.headers['x-ratelimit-reset'];
      const resetTime = rateLimitReset
        ? new Date(rateLimitReset * 1000).toLocaleTimeString()
        : 'unknown';
      const forbiddenError = new Error(
        `GitHub API access forbidden. This could be due to: rate limiting (resets at ${resetTime}), insufficient token permissions, or private user profile. Please check your GitHub token permissions.`,
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error(
        'GitHub API authentication failed - your token may be invalid or expired. Please check your GitHub token.',
      );
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    if (error.response?.status === 422) {
      const validationError = new Error(
        `GitHub API validation error - the username '${username}' may contain invalid characters`,
      );
      validationError.name = 'ValidationError';
      validationError.statusCode = 422;
      throw validationError;
    }
    if (error.response?.status >= 500) {
      const serverError = new Error(
        'GitHub API is currently experiencing issues - please try again later',
      );
      serverError.name = 'ServerError';
      serverError.statusCode = error.response.status;
      throw serverError;
    }

    // Generic API error with more context
    const apiError = new Error(
      `GitHub API error while fetching user details for '${username}': ${error.message || 'Unknown error occurred'}`,
    );
    apiError.name = 'APIError';
    apiError.statusCode = error.response?.status || 500;
    throw apiError;
  }
}

module.exports = {
  sendInvitation,
  removeUser,
  checkUserMembership,
  getUserDetails,
  getTeams,
  addUserToTeam,
};
