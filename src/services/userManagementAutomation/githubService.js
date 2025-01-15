const axios = require('axios');
const { githubConfig } = require('../../constants/automationConstants');


const { GITHUB_TOKEN: token, ORG_NAME: orgName } = githubConfig;

// GitHub API URLs
const getUserIdUrl = (username) => `https://api.github.com/users/${username}`;
const sendInvitationUrl = (orgName) => `https://api.github.com/orgs/${orgName}/invitations`;

// Set up the request headers for authorization
const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github.v3+json',
};

class GithubService {
  // Function to get the user's GitHub ID
  static async getUserId(username) {
    try {
      const response = await axios.get(getUserIdUrl(username), { headers });
      return response.data.id; // Return the GitHub ID of the user
    } catch (error) {
      console.error('Error fetching user ID:', error.message);
      throw error;
    }
  }

  // Function to send the invitation using the user ID
  static async sendInvitation(userId) {
    const payload = {
      invitee_id: userId,  // Use the user's GitHub ID
    };

    try {
      const response = await axios.post(sendInvitationUrl(orgName), payload, { headers });
      if (response.status === 201) {
        console.log(`Invitation sent to user with ID: ${userId}`);
      } else {
        console.log('Unexpected response:', response.status, response.data);
      }
    } catch (error) {
      console.error('Error sending invitation:', error.response?.data?.message || error.message);
    }
  }

  // Function to remove a user from the GitHub organization
  static async removeUser(username) {
    const url = `https://api.github.com/orgs/${orgName}/members/${username}`;
    
    try {
      const response = await axios.delete(url, { headers });

      if (response.status === 204) {
        console.log(`${username} has been successfully removed from the organization.`);
      } else {
        console.log('Unexpected response:', response.status, response.data);
      }
    } catch (error) {
      if (error.response) {
        console.error(`Error: ${error.response.status} - ${error.response.data.message}`);
      } else {
        console.error('Error:', error.message);
      }
    }
  }
}

module.exports = GithubService;
