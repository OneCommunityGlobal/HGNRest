// const axios = require('axios');

// const linkedinPostController = () => {
//   const postToLinkedin = async (req, res) => {
//     try {
//       const { content } = req.body;
//       const mediaFiles = req.files;
//       const { ORGANIZATION_URN, LINKEDIN_ACCESS_TOKEN: ACCESS_TOKEN } = process.env;

//       if (!ORGANIZATION_URN || !ACCESS_TOKEN) {
//         return res.status(400).json({
//           success: false,
//           message: 'Missing required environment variables.',
//         });
//       }

//       const uploadedAssets = [];

//       // Upload media files if provided
//       if (mediaFiles && mediaFiles.length > 0) {
//         const uploadPromises = mediaFiles.map(async (file) => {
//           // Create media upload request
//           const registerUploadRequest = {
//             registerUploadRequest: {
//               recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
//               owner: ORGANIZATION_URN,
//               serviceRelationships: [
//                 {
//                   relationshipType: 'OWNER',
//                   identifier: 'urn:li:userGeneratedContent',
//                 },
//               ],
//             },
//           };

//           const registerResponse = await axios.post(
//             'https://api.linkedin.com/v2/assets?action=registerUpload',
//             registerUploadRequest,
//             {
//               headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//                 'Content-Type': 'application/json',
//               },
//             }
//           );

//           const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
//           const asset = registerResponse.data.value.asset;

//           // Upload media file
//           await axios.put(uploadUrl, file.buffer, {
//             headers: {
//               Authorization: `Bearer ${ACCESS_TOKEN}`,
//               'Content-Type': file.mimetype,
//             },
//           });

//           return asset;
//         });

//         uploadedAssets.push(...(await Promise.all(uploadPromises)));
//       }

//       // Create post data
//       const postData = {
//         author: ORGANIZATION_URN,
//         lifecycleState: 'PUBLISHED',
//         specificContent: {
//           'com.linkedin.ugc.ShareContent': {
//             shareCommentary: { text: content },
//             shareMediaCategory: uploadedAssets.length > 0 ? 'IMAGE' : 'NONE',
//             media: uploadedAssets.map((asset) => ({
//               status: 'READY',
//               media: asset,
//             })),
//           },
//         },
//         visibility: {
//           'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
//         },
//       };

//       // Send post request to LinkedIn
//       const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
//         headers: {
//           Authorization: `Bearer ${ACCESS_TOKEN}`,
//           'Content-Type': 'application/json',
//           'X-Restli-Protocol-Version': '2.0.0',
//         },
//       });

//       res.status(200).json({
//         success: true,
//         message: 'Posted successfully to LinkedIn',
//         data: response.data,
//       });
//     } catch (error) {
//       console.error('LinkedIn post error:', error.response?.data || error.message);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to post to LinkedIn',
//         error: error.response?.data || error.message,
//       });
//     }
//   };

//   return { postToLinkedin };
// };

// module.exports = linkedinPostController;

const axios = require('axios');

const linkedinPostController = () => {
  const postToLinkedin = async (req, res) => {
    try {
      console.log('Request body:', req.body);
      const { content } = req.body;
      const mediaFiles = req.files;

      const { ORGANIZATION_URN, LINKEDIN_ACCESS_TOKEN: ACCESS_TOKEN } = process.env;

      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Content is required',
        });
      }

      if (!ORGANIZATION_URN || !ACCESS_TOKEN) {
        return res.status(400).json({
          success: false,
          message: 'Missing required environment variables.',
        });
      }

      const uploadedAssets = [];

      // Handle media files
      if (mediaFiles && mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map(async (file) => {
          const isVideo = file.mimetype.includes('video');
          const recipes = isVideo
            ? ['urn:li:digitalmediaRecipe:feedshare-video']
            : ['urn:li:digitalmediaRecipe:feedshare-image'];

          const registerUploadRequest = {
            registerUploadRequest: {
              recipes,
              owner: ORGANIZATION_URN,
              serviceRelationships: [
                {
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                },
              ],
            },
          };

          const registerResponse = await axios.post(
            'https://api.linkedin.com/v2/assets?action=registerUpload',
            registerUploadRequest,
            {
              headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
            },
          );

          const { uploadUrl } =
            registerResponse.data.value.uploadMechanism[
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
            ];
          const { asset } = registerResponse.data.value;

          await axios.put(uploadUrl, file.buffer, {
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': file.mimetype,
            },
          });

          return asset;
        });

        uploadedAssets.push(...(await Promise.all(uploadPromises)));
      }

      // Determine media category
      let shareMediaCategory = 'NONE';
      if (uploadedAssets.length > 0) {
        shareMediaCategory = mediaFiles[0].mimetype.includes('video') ? 'VIDEO' : 'IMAGE';
      }

      // Create post data
      const postData = {
        author: ORGANIZATION_URN,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory,
            media: uploadedAssets.map((asset) => ({
              status: 'READY',
              media: asset,
            })),
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      console.log('Sending post data:', JSON.stringify(postData, null, 2));

      const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Posted successfully to LinkedIn',
        data: response.data,
      });
    } catch (error) {
      console.error('LinkedIn post error:', {
        message: error.message,
        response: error.response?.data,
      });

      res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || 'Failed to post to LinkedIn',
        error: error.response?.data || error.message,
      });
    }
  };

  return { postToLinkedin };
};

module.exports = linkedinPostController;
