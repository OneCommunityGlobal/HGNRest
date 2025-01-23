const { gaxios } = require('gaxios');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN;
const orgName = process.env.ORG_NAME;

const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github.v3+json',
};

const getUserIdUrl = (username) => `https://api.github.com/users/${username}`;
const sendInvitationUrl = (orgName) => `https://api.github.com/orgs/${orgName}/invitations`;
const removeUserUrl = (orgName, username) => `https://api.github.com/orgs/${orgName}/memberships/${username}`;

// Service to fetch GitHub user ID by username
async function getUserId(username) {
  try {
    const response = await gaxios.request({
      url: getUserIdUrl(username),
      headers,
    });
    return response.data.id; // Return the GitHub ID of the user
  } catch (error) {
    throw new Error('Error fetching user ID: ' + error.message);
  }
}

// Service to send an invitation to a user to join the organization
async function sendInvitation(username) {
  try {
    const userId = await getUserId(username);
    const payload = { invitee_id: userId };

    const response = await gaxios.request({
      method: 'POST',
      url: sendInvitationUrl(orgName),
      headers,
      data: payload,
    });

    if (response.status === 201) {
      return `Invitation sent to ${username} with ID: ${userId}`;
    } else {
      throw new Error(`Unexpected response: ${response.status}`);
    }
  } catch (error) {
    throw new Error('Error sending invitation: ' + error.message);
  }
}

// Service to remove a user from the GitHub organization
async function removeUser(username) {
  try {
    const response = await gaxios.request({
      method: 'DELETE',
      url: removeUserUrl(orgName, username),
      headers,
    });

    if (response.status === 204) {
      return `${username} has been successfully removed from the organization.`;
    } else {
      throw new Error(`Unexpected response: ${response.status}`);
    }
  } catch (error) {
    throw new Error('Error removing user: ' + error.message);
  }
}

module.exports = {
  sendInvitation,
  removeUser,
};
