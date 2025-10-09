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

// Service to send an invitation to a user to join the organization
async function sendInvitation(username) {
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

    // Send the invitation
    const payload = { invitee_id: userId };
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
        `User '${username}' cannot be invited - they may already be a member or have a pending invitation`,
      );
      validationError.name = 'ValidationError';
      validationError.statusCode = 422;
      throw validationError;
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'GitHub API access forbidden - check token permissions for organization invitations',
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

    const apiError = new Error(`GitHub API error sending invitation: ${error.message}`);
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
        'GitHub API access forbidden - check token permissions for organization management',
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

    const apiError = new Error(`GitHub API error removing user: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = 500;
    throw apiError;
  }
}

module.exports = {
  sendInvitation,
  removeUser,
  checkUserMembership,
};
