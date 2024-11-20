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
    console.log('post called', req.body.postPayload);
    const { content, media } = req.body;
    const ORGANIZATION_URN = 'urn:li:organization:105518573';

    const ACCESS_TOKEN =
      'AQWDqmoKwTgQUr8Cp_QbZhu5x3-gPWpCuQ1z54kDWUpKyRVMMOSiXXsDfDJ6EJcGZyB31AlfX6EAaevSUv3gc9dshY-oRGmMAE_1KGDFcNZy8ek6iD8OKwMBcS23hSHZ4ZxLf3oCQN4wDYCjTOYT8zLRNeEUBDGHtdKgxVGmY48E7us88jbcydplTcT0rvGygv_nyNIM4qGiV-1P8J_0SsdK3QcgTNMpAYX5cgoVH_dJkQhyHTFtTo32hAelch5tgxoCPJ7nFX81l53MU_9znutYi-S1wM446rdN7ZKeUaHBxBsggPRzQf2t00n9CLK-IkZpRNvtxsm_kPuu1rj2AsZuvrEwsQ';
    try {
      const postHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'LinkedIn-Version': '202210',
        'X-Restli-Protocol-Version': '2.0.0',
      };

      const postBody = {
        author: ORGANIZATION_URN,
        lifecycleState: 'PUBLISHED',
        visibility: 'PUBLIC',
        commentary: 'Hello World',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        // content: media ? { media: [media] } : undefined,
      };

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
          console.log(data);
        });

        console.log('data', data);
        result.on('end', () => {
          if (data) {
            try {
              console.log('Response:', data);
              res.status(result.statusCode).send(JSON.parse(data));
            } catch (error) {
              console.error('Error parsing JSON:', error);
              res.status(500).send({ error: 'Invalid JSON response' });
            }
          } else {
            console.error('No data received from LinkedIn');
            res.status(500).send({ error: 'No response data from LinkedIn' });
          }
        });
      });

      request.on('error', (error) => {
        console.error('Error posting to LinkedIn:', error);
        res.status(500).send({ error: 'Failed to post to LinkedIn' });
      });

      console.log('request is', request);
      request.write(JSON.stringify(postBody));
      request.end();
    } catch (err) {
      console.log('err has occured', err);
    }
  };

  return {
    postToLinkedin,
  };
};

module.exports = linkedPostController;
