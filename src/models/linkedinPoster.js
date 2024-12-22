// const https = require('https');
const axios = require('axios');

const linkedPostController = function () {
  const postToLinkedin = async function (req, res) {
    try {
      console.log('Request received:', req.body); // Log received payload for debugging

      const { content } = req.body; // Extract content from request body
      if (!content) {
        return res.status(400).json({ error: 'Content is required' }); // Validate content
      }

      const ORGANIZATION_URN = 'urn:li:organization:105518573';
      const ACCESS_TOKEN =
        'AQWDqmoKwTgQUr8Cp_QbZhu5x3-gPWpCuQ1z54kDWUpKyRVMMOSiXXsDfDJ6EJcGZyB31AlfX6EAaevSUv3gc9dshY-oRGmMAE_1KGDFcNZy8ek6iD8OKwMBcS23hSHZ4ZxLf3oCQN4wDYCjTOYT8zLRNeEUBDGHtdKgxVGmY48E7us88jbcydplTcT0rvGygv_nyNIM4qGiV-1P8J_0SsdK3QcgTNMpAYX5cgoVH_dJkQhyHTFtTo32hAelch5tgxoCPJ7nFX81l53MU_9znutYi-S1wM446rdN7ZKeUaHBxBsggPRzQf2t00n9CLK-IkZpRNvtxsm_kPuu1rj2AsZuvrEwsQ';

      const postBody = {
        author: ORGANIZATION_URN,
        lifecycleState: 'PUBLISHED',
        visibility: 'PUBLIC',
        commentary: content.trim(), // Use content from the request
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        isReshareDisabledByAuthor: false,
      };

      console.log('Post Body being sent to LinkedIn:', JSON.stringify(postBody, null, 2)); // Log post body

      const response = await axios.post('https://api.linkedin.com/v2/posts', postBody, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      console.log('Response from LinkedIn:', response.data);
      res.status(200).json({ message: 'Post successful!', data: response.data });
    } catch (error) {
      console.error('Error posting to LinkedIn:', error.response?.data || error.message);
      res.status(500).json({
        error: 'Failed to post to LinkedIn',
        details: error.response?.data || error.message,
      });
    }
  };

  return {
    postToLinkedin,
  };
};

module.exports = linkedPostController;
