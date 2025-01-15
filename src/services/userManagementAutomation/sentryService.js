const axios = require('axios');
const { sentryConfig } =  require('../../constants/automationConstants');


// Destructure sentry config (token and organization slug) from serviceConfig
const { sentryApiToken, organizationSlug } = sentryConfig;

// Sentry API base URL
const SENTRY_API_URL = `https://sentry.io/api/0/organizations/${organizationSlug}/members/`;

class SentryService {
  // Get members from the organization and find the user to remove by email
  static async getMembers(userEmailToRemove) {
    const url = SENTRY_API_URL;

    const headers = {
      'Authorization': `Bearer ${sentryApiToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.get(url, { headers });
      console.log('Organization Members:', response.data);

      // Find the user to remove based on their email
      const userToRemove = response.data.find(member => member.email === userEmailToRemove);

      if (userToRemove) {
        console.log(`Found user: ${userToRemove.email}. Removing...`);
        await this.removeUser(userToRemove.id);  // Call removeUser() with the user ID
      } else {
        console.log(`User with email ${userEmailToRemove} not found.`);
      }
    } catch (error) {
      console.error('Error fetching organization members:', error.response ? error.response.data : error.message);
      throw new Error('Failed to fetch organization members from Sentry');
    }
  }

  // Remove a user from the Sentry organization by user ID
  static async removeUser(userId) {
    const url = `${SENTRY_API_URL}${userId}/`;

    const headers = {
      'Authorization': `Bearer ${sentryApiToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.delete(url, { headers });
      console.log(`Successfully removed user with ID ${userId} from the organization.`);
      return response.data;
    } catch (error) {
      console.error('Error removing user:', error.response ? error.response.data : error.message);
      throw new Error('Failed to remove user from Sentry');
    }
  }

  // Invite a user to the Sentry organization by their email
  static async inviteUser(email, role = 'member') {
    const url = SENTRY_API_URL;

    const headers = {
      'Authorization': `Bearer ${sentryApiToken}`,
      'Content-Type': 'application/json',
    };

    const data = {
      email: email,
      role: role,  // Can be 'admin' or 'member'
    };

    try {
      const response = await axios.post(url, data, { headers });
      console.log('Invite sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending invite:', error.response ? error.response.data : error.message);
      throw new Error('Failed to send invite to Sentry');
    }
  }
}

module.exports = SentryService;
