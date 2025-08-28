const axios = require('axios'); // Use gaxios instead of axios
require('dotenv').config();

const sentryApiToken = process.env.SENTRY_API_TOKEN; // Sentry API Token from .env file
const organizationSlug = process.env.SENTRY_ORG_SLUG; // Organization slug from .env file

// Validate required environment variables
if (!sentryApiToken) {
  throw new Error('Sentry API token is required');
}

if (!organizationSlug) {
  throw new Error('Sentry organization slug is required');
}

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
    throw new Error(`Error fetching teams: ${error.message}`);
  }
}

// Function to find member by email (direct search)
async function findMemberByEmail(email) {
  // Use Sentry's search functionality to find specific user
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/?query=${encodeURIComponent(email)}`;

  try {
    const response = await axios({ url, headers });
    const members = response.data;

    // Find exact email match (case-insensitive)
    const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase());

    return member;
  } catch (error) {
    throw new Error(`Error searching for member: ${error.message}`);
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
    throw new Error('Email is required and must be a non-empty string');
  }

  if (!role || typeof role !== 'string' || role.trim().length === 0) {
    throw new Error('Role is required and must be a non-empty string');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new Error(`Invalid email format: ${email}`);
  }

  // Check if user already exists
  const userCheck = await checkUserExists(email);
  if (userCheck.exists) {
    if (userCheck.status === 'pending') {
      throw new Error(`User ${email} already has a pending invitation`);
    } else {
      throw new Error(`User ${email} is already an active member of the organization`);
    }
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

  const response = await axios({
    url,
    method: 'POST',
    headers,
    data,
  });

  // Verify the invitation was created successfully
  if (!response.data || !response.data.id) {
    throw new Error('Failed to create invitation - no response data received');
  }

  // Verify the invitation was actually created
  await verifyInvitation(email, response.data.id);

  return {
    ...response.data,
    teamsAssigned: teams.length,
    invitationId: response.data.id,
  };
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
    throw new Error('Email is required and cannot be empty');
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error(`Invalid email format: ${cleanEmail}`);
  }

  const urlBase = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  // Find the member using direct search
  const existingMember = await findMemberByEmail(cleanEmail);

  if (!existingMember) {
    throw new Error(`User with email ${cleanEmail} is not a member of this Sentry organization`);
  }

  // Verify user exists before attempting removal (idempotency check)
  try {
    const verificationCheck = await findMemberByEmail(cleanEmail);
    if (!verificationCheck || verificationCheck.id !== existingMember.id) {
      throw new Error(`User verification failed: ${cleanEmail} may have been removed already`);
    }
  } catch (verificationError) {
    throw new Error(`User verification failed: ${verificationError.message}`);
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
    // Organization removal failed
    throw new Error(`Organization removal failed: ${orgError.message}`);
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
