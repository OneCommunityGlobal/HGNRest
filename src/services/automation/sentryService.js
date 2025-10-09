const axios = require('axios'); // Use gaxios instead of axios
require('dotenv').config();

const sentryApiToken = process.env.SENTRY_API_TOKEN; // Sentry API Token from .env file
const organizationSlug = process.env.SENTRY_ORG_SLUG; // Organization slug from .env file

const headers = {
  Authorization: `Bearer ${sentryApiToken}`,
  'Content-Type': 'application/json',
};

// Function to get all teams in the organization
async function getTeams() {
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/teams/`;

  try {
    const response = await axios({
      url,
      method: 'GET',
      headers,
    });
    return response.data; // Return the teams list
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
  // Clean the email input
  const cleanEmail = email ? email.trim() : '';

  if (!cleanEmail) {
    const validationError = new Error('Email is required and cannot be empty');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    const validationError = new Error(`Invalid email format: ${cleanEmail}`);
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  const urlBase = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  // Find the member using direct search
  const existingMember = await findMemberByEmail(cleanEmail);

  if (!existingMember) {
    const notFoundError = new Error(
      `User with email ${cleanEmail} is not a member of this Sentry organization`,
    );
    notFoundError.name = 'NotFoundError';
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  // Verify user exists before attempting removal (idempotency check)
  try {
    const verificationCheck = await findMemberByEmail(cleanEmail);
    if (!verificationCheck || verificationCheck.id !== existingMember.id) {
      const processError = new Error(
        `User verification failed: ${cleanEmail} may have been removed already`,
      );
      processError.name = 'ProcessError';
      processError.statusCode = 409;
      throw processError;
    }
  } catch (verificationError) {
    // If it's already our custom error, re-throw it
    if (verificationError.name && verificationError.statusCode) {
      throw verificationError;
    }
    const processError = new Error(`User verification failed: ${verificationError.message}`);
    processError.name = 'ProcessError';
    processError.statusCode = 500;
    throw processError;
  }

  // Step 1: Remove user from all teams first (undo the 'contributor' role assignments from invite)
  const teamRemovalResult = await removeUserFromAllTeams(existingMember.id);

  // Step 2: Remove user from organization
  const orgRemovalUrl = `${urlBase}${existingMember.id}/`;

  try {
    await axios({
      url: orgRemovalUrl,
      method: 'DELETE',
      headers,
    });

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
    // If it's already our custom error, re-throw it
    if (orgError.name && orgError.statusCode) {
      throw orgError;
    }

    // Handle Sentry API specific errors
    if (orgError.response?.status === 404) {
      const notFoundError = new Error(`User ${cleanEmail} not found in organization`);
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    if (orgError.response?.status === 403) {
      const forbiddenError = new Error(
        'Sentry API access forbidden - check token permissions for member removal',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (orgError.response?.status === 401) {
      const authError = new Error('Sentry API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }

    const apiError = new Error(
      `Sentry API error removing user from organization: ${orgError.message}`,
    );
    apiError.name = 'APIError';
    apiError.statusCode = orgError.response?.status || 500;
    throw apiError;
  }
}

module.exports = {
  getTeams,
  inviteUser,
  removeUser,
  removeUserFromAllTeams,
  findMemberByEmail,
  checkUserExists,
  verifyInvitation,
  verifyRemoval,
};
