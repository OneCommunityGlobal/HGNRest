const https = require('https');

/**
 * Helper function to send HTTPS requests
 */
// const httpsRequest = (options, data = null) =>
//   new Promise((resolve, reject) => {
//     const req = https.request(options, (res) => {
//       let responseData = '';

//       res.on('data', (chunk) => {
//         responseData += chunk;
//       });

//       res.on('end', () => {
//         if (res.statusCode >= 200 && res.statusCode < 300) {
//           resolve(JSON.parse(responseData));
//         } else {
//           reject(new Error(`Request failed with status code: ${res.statusCode}, ${responseData}`));
//         }
//       });
//     });

//     req.on('error', (error) => {
//       reject(error);
//     });

//     if (data) {
//       req.write(data);
//     }

//     req.end();
//   });

/**
 * Post to LinkedIn
 */
// const postToLinkedIn = async (req, res) => {
//   // Token is directly hardcoded here
//   const ACCESS_TOKEN =
//     'AQWDqmoKwTgQUr8Cp_QbZhu5x3-gPWpCuQ1z54kDWUpKyRVMMOSiXXsDfDJ6EJcGZyB31AlfX6EAaevSUv3gc9dshY-oRGmMAE_1KGDFcNZy8ek6iD8OKwMBcS23hSHZ4ZxLf3oCQN4wDYCjTOYT8zLRNeEUBDGHtdKgxVGmY48E7us88jbcydplTcT0rvGygv_nyNIM4qGiV-1P8J_0SsdK3QcgTNMpAYX5cgoVH_dJkQhyHTFtTo32hAelch5tgxoCPJ7nFX81l53MU_9znutYi-S1wM446rdN7ZKeUaHBxBsggPRzQf2t00n9CLK-IkZpRNvtxsm_kPuu1rj2AsZuvrEwsQ';
//   console.log('Using LinkedIn Access Token:', ACCESS_TOKEN); // Ensure this log is here
//   const ORGANIZATION_URN = 'urn:li:organization:105518573';

//   const { content, media } = req.body;

//   const postData = JSON.stringify({
//     author: ORGANIZATION_URN,
//     commentary: content,
//     visibility: 'PUBLIC',
//     lifecycleState: 'PUBLISHED',
//     distribution: {
//       feedDistribution: 'MAIN_FEED',
//       targetEntities: [],
//       thirdPartyDistributionChannels: [],
//     },
//     content: media
//       ? {
//           media: [
//             {
//               status: 'READY',
//               description: { text: 'Uploaded media' },
//               media,
//               title: { text: 'Media Title' },
//             },
//           ],
//         }
//       : undefined,
//   });

//   const options = {
//     hostname: 'api.linkedin.com',
//     path: '/v2/posts',
//     method: 'POST',
//     headers: {
//       Authorization: `Bearer ${ACCESS_TOKEN}`,
//       'Content-Type': 'application/json',
//       'X-Restli-Protocol-Version': '2.0.0',
//     },
//   };

//   console.log('Request Headers:', options.headers); // Log the headers

//   try {
//     const response = await httpsRequest(options, postData);
//     res.status(200).json({ message: 'Post successful!', data: response });
//   } catch (error) {
//     console.error('Error posting to LinkedIn:', error.message);
//     res.status(500).json({ error: `Error posting to LinkedIn: ${error.message}` });
//   }
// };

// const UserProfile = require('../models/userProfile');

const linkedPostController = function () {
  const postToLinkedin = async function (req, res) {
    try {
      console.log('Request received:', req.body); // Log incoming request

      const { content } = req.body; // Extract content from request body
      if (!content) {
        console.error('Error: Content is required');
        return res.status(400).json({ error: 'Content is required' });
      }

      const ORGANIZATION_URN = process.env.ORGANIZATION_URN || 'urn:li:organization:105518573';
      const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;

      if (!ORGANIZATION_URN || !ACCESS_TOKEN) {
        console.error('Missing environment variables');
        return res
          .status(500)
          .json({ error: 'Server configuration error: Missing environment variables' });
      }

      const postHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      };

      const postBody = {
        author: ORGANIZATION_URN,
        commentary: content,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false, // Include this field
      };

      console.log('Request Headers:', postHeaders);
      console.log('Request Body:', postBody);

      const postOptions = {
        hostname: 'api.linkedin.com',
        path: '/v2/posts',
        method: 'POST',
        headers: postHeaders,
      };

      const request = https.request(postOptions, (result) => {
        let data = '';

        result.on('data', (chunk) => {
          data += chunk;
        });

        result.on('end', () => {
          console.log('LinkedIn API Status Code:', result.statusCode);

          if (result.statusCode === 201) {
            console.log('LinkedIn API Response:', data);
            return res.status(201).json({
              message: 'Post created successfully',
              details: JSON.parse(data || '{}'), // Handle empty response gracefully
            });
          }
          console.error('LinkedIn API Error:', data);
          return res.status(result.statusCode).json({
            error: 'Failed to post to LinkedIn',
            details: data || 'No additional information',
          });
        });
      });

      request.on('error', (error) => {
        console.error('Request Error:', error);
        return res
          .status(500)
          .json({ error: 'Failed to post to LinkedIn', details: error.message });
      });

      request.write(JSON.stringify(postBody));
      request.end();
    } catch (err) {
      console.error('Unexpected Error:', err);
      return res.status(500).json({ error: 'An unexpected error occurred', details: err.message });
    }
  };

  return {
    postToLinkedin,
  };
};

module.exports = linkedPostController;
