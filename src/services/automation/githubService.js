const { Octokit } = require('@octokit/rest');
require('dotenv').config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const orgName = process.env.ORG_NAME;

// Service to fetch GitHub user ID by username
async function getUserId(username) {
  try {
    const { data } = await octokit.users.getByUsername({ username });
    return data.id;
  } catch (error) {
    throw new Error('Error fetching user ID: ' + error.message);
  }
}

// Service to send an invitation to a user to join the organization
async function sendInvitation(username) {
  try {
    const userId = await getUserId(username);
    const { data } = await octokit.orgs.createInvitation({
      org: orgName,
      invitee_id: userId,
    });
    return `Invitation sent to ${username} with ID: ${userId}`;
  } catch (error) {
    throw new Error('Error sending invitation: ' + error.message);
  }
}

// Service to remove a user from the GitHub organization
async function removeUser(username) {
  try {
    await octokit.orgs.removeMembershipForUser({
      org: orgName,
      username,
    });
    return `${username} has been successfully removed from the organization.`;
  } catch (error) {
    throw new Error('Error removing user: ' + error.message);
  }
}

// Batch operations
async function batchInviteUsers(usernames) {
  const results = [];
  for (const username of usernames) {
    try {
      const result = await sendInvitation(username);
      results.push({ username, success: true, message: result });
    } catch (error) {
      results.push({ username, success: false, error: error.message });
    }
  }
  return results;
}

async function batchRemoveUsers(usernames) {
  const results = [];
  for (const username of usernames) {
    try {
      const result = await removeUser(username);
      results.push({ username, success: true, message: result });
    } catch (error) {
      results.push({ username, success: false, error: error.message });
    }
  }
  return results;
}

module.exports = {
  sendInvitation,
  removeUser,
  batchInviteUsers,
  batchRemoveUsers,
};
