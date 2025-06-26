const axios = require('axios');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN;
const orgName = process.env.GITHUB_ORG_NAME;

const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github.v3+json',
};

const getUserIdUrl = (username) => `https://api.github.com/users/${username}`;
const sendInvitationUrl = (org) => `https://api.github.com/orgs/${org}/invitations`;
const removeUserUrl = (org, username) => `https://api.github.com/orgs/${org}/memberships/${username}`;

// Service to fetch GitHub user ID by username
async function getUserId(username) {
  try {
    const response = await axios({
      url: getUserIdUrl(username),
      headers,
    });
    return response.data.id;
  } catch (error) {
    throw new Error('Username not found');
  }
}

// Service to send an invitation to a user to join the organization
async function sendInvitation(username) {
  try{
    const userId = await getUserId(username);
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
    throw new Error(`Unexpected response: ${response.status}`);
  } catch (error) {
    throw new Error(`Github: Error sending invitation : ${error.message}`);
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
  } catch (error) {
    throw new Error('Github: Error removing user');
  }
}

module.exports = {
  sendInvitation,
  removeUser,
};