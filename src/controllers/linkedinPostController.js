// controllers/linkedinPostController.js
const https = require('https');
require('dotenv').config();

const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const ORGANIZATION_URN = process.env.LINKEDIN_ORGANIZATION_URN;

/**
 * Helper function to send HTTPS requests
 */
const httpsRequest = (options, data = null) =>
  new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`Request failed with status code: ${res.statusCode}, ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });

/**
 * post to LinkedIn
 */
exports.postToLinkedIn = async (req, res) => {
  const { content } = req.body;

  const postData = JSON.stringify({
    author: ORGANIZATION_URN,
    commentary: content,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  });

  const options = {
    hostname: 'api.linkedin.com',
    path: '/v2/posts',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  };

  try {
    const response = await httpsRequest(options, postData);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: `Error posting to LinkedIn: ${error.message}` });
  }
};
