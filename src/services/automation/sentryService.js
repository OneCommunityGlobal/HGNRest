const axios = require('axios'); // Use gaxios instead of axios
require('dotenv').config();

const sentryApiToken = process.env.SENTRY_API_TOKEN; // Sentry API Token from .env file
const organizationSlug = process.env.SENTRY_ORG_SLUG; // Organization slug from .env file

const headers = {
  Authorization: `Bearer ${sentryApiToken}`,
  'Content-Type': 'application/json',
};

// Function to get all members of the organization
async function getMembers() {
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;
  const members = [];
  let nextUrl = url;

  try {
    if (nextUrl) {
      const response = await axios({ url: nextUrl, headers });
      members.push(...response.data); // Add members to the array
      nextUrl =
        response.headers.link && response.headers.link.includes('rel="next"')
          ? response.headers.link.match(/<([^>]+)>; rel="next"/)[1]
          : null; // Extract next URL from 'link' header if available
    }
    return members;
  } catch (error) {
    throw new Error('Sentry: Error fetching organization members');
  }
}

// Function to invite a user to the Sentry organization
async function inviteUser(email, role = 'member') {
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  const data = {
    email,
    role, // Default to 'member', can also be 'admin'
  };

  try {
    const response = await axios({
      url,
      method: 'POST',
      headers,
      data,
    });
    return response.data; // Return the invitation details
  } catch (error) {
    // Handle Sentry API specific errors
    if (error.response?.status === 403) {
      const forbiddenError = new Error('Sentry API access forbidden - check token permissions');
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('Sentry API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    if (error.response?.status === 404) {
      const notFoundError = new Error('Organization not found - check organization slug');
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    const apiError = new Error(`Sentry API error fetching teams: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = error.response?.status || 500;
    throw apiError;
  }
}

// Function to find member by email (direct search)
async function findMemberByEmail(email) {
  // Input validation
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    const validationError = new Error('Email is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  // Use Sentry's search functionality to find specific user
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/?query=${encodeURIComponent(email)}`;

  try {
    const response = await axios({ url, headers });
    const members = response.data;

    // Find exact email match (case-insensitive)
    const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase());

    return member;
  } catch (error) {
    // Handle Sentry API specific errors
    if (error.response?.status === 403) {
      const forbiddenError = new Error('Sentry API access forbidden - check token permissions');
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('Sentry API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }

    const apiError = new Error(`Sentry API error searching for member: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = error.response?.status || 500;
    throw apiError;
  }
}

// Function to check if user already exists in organization
async function checkUserExists(email) {
  const existingMember = await findMemberByEmail(email);

  if (existingMember) {
    const status = existingMember.pending ? 'pending' : 'active';
    return {
      exists: true,
      member: existingMember,
      status,
    };
  }

  return { exists: false, member: null, status: null };
}

// Function to verify user invitation was successful
async function verifyInvitation(email, invitationId) {
  try {
    const member = await findMemberByEmail(email);

    if (!member) {
      throw new Error(
        `Invitation verification failed: User ${email} not found in organization members`,
      );
    }

    if (member.id !== invitationId) {
      throw new Error(`Invitation verification failed: Member ID mismatch`);
    }

    const status = member.pending ? 'pending' : 'active';

    return {
      verified: true,
      member,
      status,
    };
  } catch (error) {
    throw new Error(`Invitation verification failed: ${error.message}`);
  }
}

// Function to verify user removal was successful
async function verifyRemoval(email) {
  try {
    const member = await findMemberByEmail(email);

    if (member) {
      throw new Error(`Removal verification failed: User ${email} still exists in organization`);
    }

    return { verified: true };
  } catch (error) {
    throw new Error(`Removal verification failed: ${error.message}`);
  }
}

// Function to invite a user to the Sentry organization and add them to all teams
async function inviteUser(email, role = 'member') {
  // Input validation
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    const validationError = new Error('Email is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  if (!role || typeof role !== 'string' || role.trim().length === 0) {
    const validationError = new Error('Role is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    const validationError = new Error(`Invalid email format: ${email}`);
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  // Check if user already exists
  const userCheck = await checkUserExists(email);
  if (userCheck.exists) {
    if (userCheck.status === 'pending') {
      const conflictError = new Error(`User ${email} already has a pending invitation`);
      conflictError.name = 'ConflictError';
      conflictError.statusCode = 409;
      throw conflictError;
    }
    const conflictError = new Error(
      `User ${email} is already an active member of the organization`,
    );
    conflictError.name = 'ConflictError';
    conflictError.statusCode = 409;
    throw conflictError;
  }

  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  // First, get all teams in the organization
  const teams = await getTeams();

  // Create teamRoles array to assign user to all teams as contributor
  const teamRoles = teams.map((team) => ({
    teamSlug: team.slug,
    role: 'contributor', // Assign as contributor to all teams
  }));

  const data = {
    email,
    orgRole: role, // Organization-level role (member, admin, etc.)
    teamRoles, // Assign to all teams
    sendInvite: true,
  };

  try {
    const response = await axios({
      url,
      method: 'POST',
      headers,
      data,
    });

    // Verify the invitation was created successfully
    if (!response.data || !response.data.id) {
      const processError = new Error('Failed to create invitation - no response data received');
      processError.name = 'ProcessError';
      processError.statusCode = 500;
      throw processError;
    }

    // Verify the invitation was actually created
    await verifyInvitation(email, response.data.id);

    return {
      ...response.data,
      teamsAssigned: teams.length,
      invitationId: response.data.id,
    };
  } catch (error) {
    // If it's already our custom error with proper properties, re-throw it
    if (error.name && error.statusCode) {
      throw error;
    }

    // Handle Sentry API specific errors
    if (error.response?.status === 400) {
      const validationError = new Error(`Invalid invitation data: ${error.message}`);
      validationError.name = 'ValidationError';
      validationError.statusCode = 400;
      throw validationError;
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'Sentry API access forbidden - check token permissions for invitations',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error('Sentry API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    if (error.response?.status === 409) {
      const conflictError = new Error(`User ${email} already exists or has a pending invitation`);
      conflictError.name = 'ConflictError';
      conflictError.statusCode = 409;
      throw conflictError;
    }

    const apiError = new Error(`Sentry API error sending invitation: ${error.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = error.response?.status || 500;
    throw apiError;
  }
}

// Function to remove a user from all teams (undo invite process)
async function removeUserFromAllTeams(memberId) {
  try {
    // Get all teams in the organization (same as invite process)
    const teams = await getTeams();

    if (teams.length === 0) {
      return { removedFrom: 0, totalTeams: 0 };
    }

    // Remove user from all teams in parallel (reverse of invite process)
    const removalResults = await Promise.allSettled(
      teams.map(async (team) => {
        const teamRemoveUrl = `https://sentry.io/api/0/organizations/${organizationSlug}/members/${memberId}/teams/${team.slug}/`;

        try {
          await axios({
            url: teamRemoveUrl,
            method: 'DELETE',
            headers,
          });
          return { success: true, teamName: team.name, teamSlug: team.slug };
        } catch (teamError) {
          // If user is not in the team (404), that's fine - they're already removed
          if (teamError.response && teamError.response.status === 404) {
            return {
              success: true,
              teamName: team.name,
              teamSlug: team.slug,
              alreadyRemoved: true,
            };
          }
          // For other errors, throw to indicate failure
          throw new Error(`Failed to remove from team ${team.name}: ${teamError.message}`);
        }
      }),
    );

    // Analyze results
    const successful = removalResults.filter(
      (result) => result.status === 'fulfilled' && result.value.success,
    );
    const failed = removalResults.filter((result) => result.status === 'rejected');

    if (failed.length > 0) {
      const failedTeams = failed.map((f) => f.reason.message);
      throw new Error(`Failed to remove from teams: ${failedTeams.join(', ')}`);
    }

    return {
      removedFrom: successful.length,
      totalTeams: teams.length,
      success: true,
    };
  } catch (error) {
    throw new Error(`Error removing user from teams: ${error.message}`);
  }
}

// Function to remove a user completely (undo the entire invite process)
// This mirrors inviteUser() but in reverse: remove from all teams, then from organization
async function removeUser(email) {
  const cleanEmail = (email || '').trim();
  if (!cleanEmail) {
    const e = new Error('Email is required and cannot be empty');
    e.name = 'ValidationError'; e.statusCode = 400; throw e;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    const e = new Error(`Invalid email format: ${cleanEmail}`);
    e.name = 'ValidationError'; e.statusCode = 400; throw e;
  }

  const urlBase = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  // Find the member
  const existingMember = await findMemberByEmail(cleanEmail);
  if (!existingMember) {
    const e = new Error(`User with email ${cleanEmail} is not a member of this Sentry organization`);
    e.name = 'NotFoundError'; e.statusCode = 404; throw e;
  }

  // Idempotency check
  try {
    const verificationCheck = await findMemberByEmail(cleanEmail);
    if (!verificationCheck || verificationCheck.id !== existingMember.id) {
      const e = new Error(`User verification failed: ${cleanEmail} may have been removed already`);
      e.name = 'ProcessError'; e.statusCode = 409; throw e;
    }
  } catch (verificationError) {
    if (verificationError.name && verificationError.statusCode) throw verificationError;
    const e = new Error(`User verification failed: ${verificationError.message}`);
    e.name = 'ProcessError'; e.statusCode = 500; throw e;
  }

  // --- The missing try starts here ---
  try {
    // First remove from all teams
    const teamRemovalResult = await removeUserFromAllTeams(existingMember.id);

    // Then remove from organization
    const url = `${urlBase}${existingMember.id}/`;
    await axios({ url, method: 'DELETE', headers });

    // Verify removal
    await verifyRemoval(cleanEmail);

    return {
      success: true,
      message: `Successfully removed user from organization and ${teamRemovalResult.removedFrom} teams: ${cleanEmail}`,
      userEmail: cleanEmail,
      memberId: existingMember.id,
      teamsRemoved: teamRemovalResult.removedFrom,
      totalTeams: teamRemovalResult.totalTeams,
    };
  } catch (orgError) {
    if (orgError.name && orgError.statusCode) throw orgError;

    if (orgError.response?.status === 404) {
      const e = new Error(`User ${cleanEmail} not found in organization`);
      e.name = 'NotFoundError'; e.statusCode = 404; throw e;
    }
    if (orgError.response?.status === 403) {
      const e = new Error('Sentry API access forbidden - check token permissions for member removal');
      e.name = 'ForbiddenError'; e.statusCode = 403; throw e;
    }
    if (orgError.response?.status === 401) {
      const e = new Error('Sentry API authentication failed - check token validity');
      e.name = 'UnauthorizedError'; e.statusCode = 401; throw e;
    }

    const e = new Error(`Sentry API error removing user from organization: ${orgError.message}`);
    e.name = 'APIError'; e.statusCode = orgError.response?.status || 500; throw e;
  }
}


// Get detailed user information from Sentry
async function getUserDetails(email) {
  // Input validation
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    const validationError = new Error('Email is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  try {
    // Use the existing efficient findMemberByEmail function
    const user = await findMemberByEmail(email);

    if (!user) {
      const notFoundError = new Error(
        `User with email '${email}' not found in Sentry organization`,
      );
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    // Get detailed member information including teams using the member-specific endpoint
    let userTeams = [];
    try {
      const memberDetailsUrl = `https://sentry.io/api/0/organizations/${organizationSlug}/members/${user.id}/`;
      const memberDetailsResponse = await axios({
        url: memberDetailsUrl,
        method: 'GET',
        headers,
      });

      const memberData = memberDetailsResponse.data;

      // Extract team information from member details
      // teams is an array of slugs, teamRoles is an array of {teamSlug, role} objects
      if (memberData.teams && memberData.teams.length > 0) {
        // Use team slugs with hash prefix to match Sentry UI format
        userTeams = memberData.teams.map((teamSlug) => ({
          name: `#${teamSlug}`,
        }));
      } else {
        userTeams = [];
      }
    } catch (memberDetailsError) {
      // Fallback: keep empty teams array
      userTeams = [];
    }

    const userDetails = {
      email: user.email,
      name: user.name || 'Not set',
      organizationRole: user.orgRole || 'member',
      status: user.pending ? 'pending' : 'active',
      memberSince: user.dateCreated,
      lastActive: user.user?.lastActive || user.dateCreated,
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
        'Unable to connect to Sentry API - please check your internet connection',
      );
      networkError.name = 'NetworkError';
      networkError.statusCode = 503;
      throw networkError;
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const timeoutError = new Error('Sentry API request timed out - please try again');
      timeoutError.name = 'TimeoutError';
      timeoutError.statusCode = 408;
      throw timeoutError;
    }

    // Handle Sentry API specific errors
    if (error.response?.status === 404) {
      // Check if it's organization not found vs user not found
      if (error.config?.url?.includes('/members/')) {
        const notFoundError = new Error(
          `User with email '${email}' not found in Sentry organization`,
        );
        notFoundError.name = 'NotFoundError';
        notFoundError.statusCode = 404;
        throw notFoundError;
      } else {
        const notFoundError = new Error(
          `Sentry organization '${organizationSlug}' not found or you don't have access`,
        );
        notFoundError.name = 'NotFoundError';
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
    }
    if (error.response?.status === 403) {
      const forbiddenError = new Error(
        'Sentry API access forbidden - your token may lack necessary permissions for organization or member access',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.response?.status === 401) {
      const authError = new Error(
        'Sentry API authentication failed - your token may be invalid or expired. Please check your Sentry API token.',
      );
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    if (error.response?.status === 400) {
      const badRequestError = new Error(
        `Invalid request to Sentry API - please check the email format '${email}'`,
      );
      badRequestError.name = 'ValidationError';
      badRequestError.statusCode = 400;
      throw badRequestError;
    }
    if (error.response?.status === 429) {
      const rateLimitError = new Error(
        'Sentry API rate limit exceeded - please wait a moment before trying again',
      );
      rateLimitError.name = 'RateLimitError';
      rateLimitError.statusCode = 429;
      throw rateLimitError;
    }
    if (error.response?.status >= 500) {
      const serverError = new Error(
        'Sentry API is currently experiencing issues - please try again later',
      );
      serverError.name = 'ServerError';
      serverError.statusCode = error.response.status;
      throw serverError;
    }

    // Generic API error with more context
    const apiError = new Error(
      `Sentry API error while fetching user details for '${email}': ${error.message}`,
    );
    apiError.name = 'APIError';
    apiError.statusCode = error.response?.status || 500;
    throw apiError;
  }
}

module.exports = {
  getMembers,
  inviteUser,
  removeUser,
  removeUserFromAllTeams,
  findMemberByEmail,
  checkUserExists,
  verifyInvitation,
  verifyRemoval,
  getUserDetails,
};
