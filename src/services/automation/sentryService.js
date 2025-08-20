const axios = require('axios'); // Use gaxios instead of axios
require('dotenv').config();

const sentryApiToken = process.env.SENTRY_API_TOKEN; // Sentry API Token from .env file
const organizationSlug = process.env.SENTRY_ORG_SLUG; // Organization slug from .env file

// Validate required environment variables
if (!sentryApiToken) {
  // console.error('[SENTRY] ERROR: SENTRY_API_TOKEN is not set in environment variables');
  throw new Error('Sentry API token is required');
}

if (!organizationSlug) {
  // console.error('[SENTRY] ERROR: SENTRY_ORG_SLUG is not set in environment variables');
  throw new Error('Sentry organization slug is required');
}

const headers = {
  Authorization: `Bearer ${sentryApiToken}`,
  'Content-Type': 'application/json',
};

// Function to get all teams in the organization
async function getTeams() {
  // console.log(`[SENTRY] Fetching teams from organization: ${organizationSlug}`);
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/teams/`;

  try {
    const response = await axios({
      url,
      method: 'GET',
      headers,
    });
    // console.log(`[SENTRY] ✅ Successfully fetched ${response.data.length} teams`);
    return response.data; // Return the teams list
  } catch (error) {
    // console.error(`[SENTRY] ERROR: Failed to fetch teams:`, {
    //   message: error.message,
    //   status: error.response?.status,
    //   organizationSlug,
    // });
    throw new Error(`Error fetching teams: ${error.message}`);
  }
}

// Function to find member by email (direct search)
async function findMemberByEmail(email) {
  // console.log(`[SENTRY] 🔍 Searching for member with email: ${email}`);

  // Use Sentry's search functionality to find specific user
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/?query=${encodeURIComponent(email)}`;

  try {
    const response = await axios({ url, headers });
    const members = response.data;

    // console.log(`[SENTRY] 📋 Search returned ${members.length} potential matches`);

    // Find exact email match (case-insensitive)
    const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase());

    if (member) {
      // console.log(
      //   `[SENTRY] ✅ Found member: ${member.email} (ID: ${member.id}, Status: ${member.pending ? 'pending' : 'active'})`,
      // );
    } else {
      // console.log(`[SENTRY] ❌ No exact match found for email: ${email}`);
    }

    return member;
  } catch (error) {
    // console.error(`[SENTRY] 🚨 Error searching for member ${email}:`, error.message);
    throw new Error(`Error searching for member: ${error.message}`);
  }
}

// Function to check if user already exists in organization
async function checkUserExists(email) {
  // console.log(`[SENTRY] 🔍 Checking if user exists: ${email}`);

  const existingMember = await findMemberByEmail(email);

  if (existingMember) {
    const status = existingMember.pending ? 'pending' : 'active';
    // console.log(`[SENTRY] ✅ User exists with status: ${status}`);
    return {
      exists: true,
      member: existingMember,
      status,
    };
  }

  // console.log(`[SENTRY] ❌ User does not exist: ${email}`);
  return { exists: false, member: null, status: null };
}

// Function to verify user invitation was successful
async function verifyInvitation(email, invitationId) {
  // console.log(`[SENTRY] 🔍 Verifying invitation for: ${email} (Invitation ID: ${invitationId})`);

  try {
    const member = await findMemberByEmail(email);

    if (!member) {
      // console.error(`[SENTRY] ❌ Invitation verification failed: User ${email} not found`);
      throw new Error(
        `Invitation verification failed: User ${email} not found in organization members`,
      );
    }

    if (member.id !== invitationId) {
      // console.error(
      //   `[SENTRY] ❌ Invitation verification failed: Member ID mismatch (Expected: ${invitationId}, Found: ${member.id})`,
      // );
      throw new Error(`Invitation verification failed: Member ID mismatch`);
    }

    const status = member.pending ? 'pending' : 'active';
    // console.log(`[SENTRY] ✅ Invitation verified successfully: ${email} (Status: ${status})`);

    return {
      verified: true,
      member,
      status,
    };
  } catch (error) {
    // console.error(`[SENTRY] 🚨 Invitation verification failed: ${error.message}`);
    throw new Error(`Invitation verification failed: ${error.message}`);
  }
}

// Function to verify user removal was successful
async function verifyRemoval(email) {
  // console.log(`[SENTRY] 🔍 Verifying removal for: ${email}`);

  try {
    const member = await findMemberByEmail(email);

    if (member) {
      // console.error(
      //   `[SENTRY] ❌ Removal verification failed: User ${email} still exists in organization`,
      // );
      throw new Error(`Removal verification failed: User ${email} still exists in organization`);
    }

    // console.log(
    //   `[SENTRY] ✅ Removal verified successfully: ${email} no longer exists in organization`,
    // );
    return { verified: true };
  } catch (error) {
    // console.error(`[SENTRY] 🚨 Removal verification failed: ${error.message}`);
    throw new Error(`Removal verification failed: ${error.message}`);
  }
}

// Function to invite a user to the Sentry organization and add them to all teams
async function inviteUser(email, role = 'member') {
  // console.log(`[SENTRY] 📧 Starting invitation process for: ${email} (Role: ${role})`);

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
    // console.error(`[SENTRY] ❌ Invalid email format: ${email}`);
    throw new Error(`Invalid email format: ${email}`);
  }

  // console.log(`[SENTRY] ✅ Email format validated: ${email}`);

  // Check if user already exists
  // console.log(`[SENTRY] 🔍 Checking if user already exists: ${email}`);
  const userCheck = await checkUserExists(email);
  if (userCheck.exists) {
    if (userCheck.status === 'pending') {
      // console.error(`[SENTRY] ❌ User ${email} already has a pending invitation`);
      throw new Error(`User ${email} already has a pending invitation`);
    } else {
      // console.error(`[SENTRY] ❌ User ${email} is already an active member of the organization`);
      throw new Error(`User ${email} is already an active member of the organization`);
    }
  }

  // console.log(`[SENTRY] ✅ User does not exist, proceeding with invitation`);

  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  // First, get all teams in the organization
  // console.log(`[SENTRY] 🔍 Fetching teams for organization: ${organizationSlug}`);
  const teams = await getTeams();
  // console.log(`[SENTRY] 📋 Found ${teams.length} teams to assign user to`);

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

  // console.log(`[SENTRY] 📤 Sending invitation request to Sentry API...`);
  const response = await axios({
    url,
    method: 'POST',
    headers,
    data,
  });

  // Verify the invitation was created successfully
  if (!response.data || !response.data.id) {
    // console.error(`[SENTRY] ❌ Failed to create invitation - no response data received`);
    throw new Error('Failed to create invitation - no response data received');
  }

  // console.log(`[SENTRY] ✅ Invitation created successfully (ID: ${response.data.id})`);

  // Verify the invitation was actually created
  // console.log(`[SENTRY] 🔍 Verifying invitation was created...`);
  await verifyInvitation(email, response.data.id);

  // console.log(
  //   `[SENTRY] 🎉 Successfully invited ${email} to organization and ${teams.length} teams`,
  // );
  return {
    ...response.data,
    teamsAssigned: teams.length,
    invitationId: response.data.id,
  };
}

// Function to remove a user from all teams (undo invite process)
async function removeUserFromAllTeams(memberId) {
  // console.log(`[SENTRY] 🗑️ Starting team removal process for member ID: ${memberId}`);

  try {
    // Get all teams in the organization (same as invite process)
    // console.log(`[SENTRY] 🔍 Fetching teams for removal...`);
    const teams = await getTeams();

    if (teams.length === 0) {
      // console.log(`[SENTRY] ℹ️ No teams found, nothing to remove from`);
      return { removedFrom: 0, totalTeams: 0 };
    }

    // console.log(`[SENTRY] 📋 Found ${teams.length} teams to remove user from`);

    // Remove user from all teams in parallel (reverse of invite process)
    // console.log(`[SENTRY] 🔄 Removing user from ${teams.length} teams in parallel...`);
    const removalResults = await Promise.allSettled(
      teams.map(async (team) => {
        const teamRemoveUrl = `https://sentry.io/api/0/organizations/${organizationSlug}/members/${memberId}/teams/${team.slug}/`;

        try {
          await axios({
            url: teamRemoveUrl,
            method: 'DELETE',
            headers,
          });
          // console.log(`[SENTRY] ✅ Successfully removed from team: ${team.name}`);
          return { success: true, teamName: team.name, teamSlug: team.slug };
        } catch (teamError) {
          // If user is not in the team (404), that's fine - they're already removed
          if (teamError.response && teamError.response.status === 404) {
            // console.log(`[SENTRY] ℹ️ User already removed from team: ${team.name}`);
            return {
              success: true,
              teamName: team.name,
              teamSlug: team.slug,
              alreadyRemoved: true,
            };
          }
          // For other errors, throw to indicate failure
          // console.error(
          //   `[SENTRY] ❌ Failed to remove from team ${team.name}: ${teamError.message}`,
          // );
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
      // console.error(`[SENTRY] ❌ Team removal failed: ${failedTeams.join(', ')}`);
      throw new Error(`Failed to remove from teams: ${failedTeams.join(', ')}`);
    }

    // console.log(`[SENTRY] ✅ Successfully removed from ${successful.length}/${teams.length} teams`);
    return {
      removedFrom: successful.length,
      totalTeams: teams.length,
      success: true,
    };
  } catch (error) {
    // console.error(`[SENTRY] 🚨 Error removing user from teams: ${error.message}`);
    throw new Error(`Error removing user from teams: ${error.message}`);
  }
}

// Function to remove a user completely (undo the entire invite process)
// This mirrors inviteUser() but in reverse: remove from all teams, then from organization
async function removeUser(email) {
  // console.log(`[SENTRY] 🗑️ Starting user removal process for: ${email}`);

  // Clean the email input
  const cleanEmail = email ? email.trim() : '';

  if (!cleanEmail) {
    // console.error(`[SENTRY] ❌ Email is required and cannot be empty`);
    throw new Error('Email is required and cannot be empty');
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    // console.error(`[SENTRY] ❌ Invalid email format: ${cleanEmail}`);
    throw new Error(`Invalid email format: ${cleanEmail}`);
  }

  // console.log(`[SENTRY] ✅ Email format validated: ${cleanEmail}`);

  const urlBase = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  // Find the member using direct search
  // console.log(`[SENTRY] 🔍 Finding member in organization: ${cleanEmail}`);
  const existingMember = await findMemberByEmail(cleanEmail);

  if (!existingMember) {
    // console.error(
    //   `[SENTRY] ❌ User with email ${cleanEmail} is not a member of this Sentry organization`,
    // );
    throw new Error(`User with email ${cleanEmail} is not a member of this Sentry organization`);
  }

  // console.log(`[SENTRY] ✅ Found member: ${existingMember.email} (ID: ${existingMember.id})`);

  // Verify user exists before attempting removal (idempotency check)
  // console.log(`[SENTRY] 🔍 Verifying user exists before removal...`);
  try {
    const verificationCheck = await findMemberByEmail(cleanEmail);
    if (!verificationCheck || verificationCheck.id !== existingMember.id) {
      // console.error(
      //   `[SENTRY] ❌ User verification failed: ${cleanEmail} may have been removed already`,
      // );
      throw new Error(`User verification failed: ${cleanEmail} may have been removed already`);
    }
    // console.log(`[SENTRY] ✅ User verification successful`);
  } catch (verificationError) {
    // console.error(`[SENTRY] ❌ User verification failed: ${verificationError.message}`);
    throw new Error(`User verification failed: ${verificationError.message}`);
  }

  // Step 1: Remove user from all teams first (undo the 'contributor' role assignments from invite)
  // console.log(`[SENTRY] 🔄 Step 1: Removing user from all teams...`);
  const teamRemovalResult = await removeUserFromAllTeams(existingMember.id);

  // Step 2: Remove user from organization
  // console.log(`[SENTRY] 🔄 Step 2: Removing user from organization...`);
  const orgRemovalUrl = `${urlBase}${existingMember.id}/`;

  try {
    // console.log(`[SENTRY] 📤 Sending organization removal request...`);
    await axios({
      url: orgRemovalUrl,
      method: 'DELETE',
      headers,
    });

    // console.log(`[SENTRY] ✅ Organization removal request successful`);

    // Verify removal
    // console.log(`[SENTRY] 🔍 Verifying user removal from organization...`);
    await verifyRemoval(cleanEmail);

    // console.log(
    //   `[SENTRY] 🎉 Successfully removed user from organization and ${teamRemovalResult.removedFrom} teams: ${cleanEmail}`,
    // );
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
    // console.error(`[SENTRY] ❌ Organization removal failed: ${orgError.message}`);
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
