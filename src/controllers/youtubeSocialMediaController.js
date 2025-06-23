const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { hasPermission } = require('../utilities/permissions');
const { getYoutubeAccountById } = require('../utilities/youtubeAccountUtil');

// Read sensitive config from environment variables
const CLIENT_ID = process.env.YT_CLIENT_ID;
const CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const REDIRECT_URI = process.env.YT_REDIRECT_URI;
const REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

const youtubeUploadController = () => {
  const uploadVideo = async (req, res) => {
    console.log('==== uploadVideo controller called ====');
    try {
      console.log('===== Incoming Request =====');
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);

      // Only allow Owner to upload
      const requestor = req.requestor;
      if (!requestor || requestor.role !== 'Owner') {
        return res.status(403).json({ error: 'Only Owner can upload videos to YouTube' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
      }

      const {
        youtubeAccountId,
        title,
        description,
        tags,
        categoryId,
        privacyStatus
      } = req.body;

      if (!youtubeAccountId) {
        return res.status(400).json({ 
          error: 'Missing required parameter',
          details: 'youtubeAccountId is required',
          receivedParams: {
            title,
            description,
            tags,
            privacyStatus
          }
        });
      }

      // Lookup YouTube account info
      const account = await getYoutubeAccountById(youtubeAccountId);
      if (!account) {
        return res.status(400).json({ 
          error: 'Invalid YouTube account',
          details: `No account found with id: ${youtubeAccountId}`
        });
      }

      // Use refresh token to automatically get access token
      const oauth2Client = new google.auth.OAuth2(
        account.clientId,
        account.clientSecret,
        account.redirectUri
      );
      oauth2Client.setCredentials({ refresh_token: account.refreshToken });
      await oauth2Client.getAccessToken();

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const filePath = req.file.path;
      const videoStream = fs.createReadStream(filePath);

      console.log('Uploading to YouTube with details:', {
        title,
        description,
        tags,
        categoryId,
        privacyStatus,
        youtubeAccountId,
        accountName: account.displayName
      });

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            categoryId: categoryId || '22',
            defaultLanguage: 'en',
            defaultAudioLanguage: 'en'
          },
          status: {
            privacyStatus: privacyStatus || 'private',
          },
        },
        media: {
          body: videoStream,
        },
      });

      // Clean up the uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temporary file:', err);
      });

      console.log('YouTube response:', response.data);

      res.status(200).json({
        message: 'Video uploaded successfully',
        videoId: response.data.id,
        url: `https://www.youtube.com/watch?v=${response.data.id}`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        error: 'Upload failed', 
        details: error.message,
        stack: error.stack 
      });
    }
  };

  return { uploadVideo };
};

module.exports = youtubeUploadController;
