const axios = require('axios');  // Use gaxios instead of axios
require('dotenv').config();

const sentryApiToken = process.env.SENTRY_API_TOKEN;  // Sentry API Token from .env file
const organizationSlug = process.env.SENTRY_ORG_SLUG;  // Organization slug from .env file

const headers = {
  'Authorization': `Bearer ${sentryApiToken}`,
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
      members.push(...response.data);  // Add members to the array
      nextUrl = response.headers.link && response.headers.link.includes('rel="next"') 
                ? response.headers.link.match(/<([^>]+)>; rel="next"/)[1]
                : null;  // Extract next URL from 'link' header if available
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
    role,  // Default to 'member', can also be 'admin'
  };

  try {
    const response = await axios({
      url,
      method: 'POST',
      headers,
      data,
    });
    return response.data;  // Return the invitation details
  } catch (error) {
    throw new Error(`Error sending invitation: ${error.message}`);
  }
}

// Function to remove a user by email (checks if exists first)
async function removeUser(email, members) {
  const urlBase = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

  try {
    // If no members passed, fetch
    if (!members) {
      members = await getMembers();
    }

    const existingMember = members.find(member =>
      member.email.toLowerCase() === email.toLowerCase()
    );

    if (!existingMember) {
      return `User with email ${email} is not a member. Nothing to remove.`;
    }

    // Remove by userId
    const url = `${urlBase}${existingMember.id}/`;
    await axios({
      url,
      method: 'DELETE',
      headers,
    });
    console.log(`Sentry: Successfully removed user ${email} (ID: ${existingMember.id}).`);
    return `Removed user ${email}`;
  } catch (error) {
    console.error(error);
    throw new Error(`Error removing user: ${error.message}`);
  }
}

module.exports = {
  getMembers,
  inviteUser,
  removeUser,
};