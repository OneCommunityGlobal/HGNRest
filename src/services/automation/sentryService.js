const { request } = require('gaxios'); // Use gaxios instead of axios
require('dotenv').config();

const sentryApiToken = process.env.SENTRY_API_TOKEN; // Sentry API Token from .env file
const organizationSlug = process.env.SENTRY_ORG_SLUG; // Organization slug from .env file

const headers = {
  Authorization: `Bearer ${sentryApiToken}`,
  'Content-Type': 'application/json',
};

// Function to parse Link header and extract next URL
function parseLinkHeader(linkHeader) {
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  for (const link of links) {
    const [url, rel] = link.split(';');
    if (rel.includes('rel="next"')) {
      return url.trim().slice(1, -1); // Remove < and >
    }
  }
  return null;
}

// Function to get all members of the organization with improved pagination
async function getMembers() {
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;
  const members = [];
  let nextUrl = url;

  try {
    while (nextUrl) {
      const response = await request({
        url: nextUrl,
        headers,
        params: { per_page: 100 }, // Request maximum items per page
      });

      if (Array.isArray(response.data)) {
        members.push(
          ...response.data.map((member) => ({
            id: member.id,
            email: member.email,
            role: member.role,
            name: member.name,
          })),
        );
      }

      nextUrl = parseLinkHeader(response.headers.link);

      // Add a small delay to avoid rate limiting
      if (nextUrl) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return members;
  } catch (error) {
    throw new Error('Error fetching organization members: ' + error.message);
  }
}

// Function to invite a user to the Sentry organization
async function inviteUser(email, role = 'member') {
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  const data = {
    email,
    role,
  };

  try {
    const response = await request({
      url,
      method: 'POST',
      headers,
      data,
    });
    return response.data;
  } catch (error) {
    throw new Error('Error sending invitation: ' + error.message);
  }
}

// Function to remove a user from the Sentry organization by user ID
async function removeUser(userId) {
  const url = `https://sentry.io/api/0/organizations/${organizationSlug}/members/${userId}/`;

  try {
    await request({
      url,
      method: 'DELETE',
      headers,
    });
    return `Successfully removed user with ID ${userId} from the organization.`;
  } catch (error) {
    throw new Error('Error removing user: ' + error.message);
  }
}

// Batch operations
async function batchInviteUsers(users) {
  const results = [];
  for (const user of users) {
    try {
      const result = await inviteUser(user.email, user.role);
      results.push({ email: user.email, success: true, data: result });
    } catch (error) {
      results.push({ email: user.email, success: false, error: error.message });
    }
    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}

async function batchRemoveUsers(userIds) {
  const results = [];
  for (const userId of userIds) {
    try {
      const result = await removeUser(userId);
      results.push({ userId, success: true, message: result });
    } catch (error) {
      results.push({ userId, success: false, error: error.message });
    }
    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}

module.exports = {
  getMembers,
  inviteUser,
  removeUser,
  batchInviteUsers,
  batchRemoveUsers,
};
