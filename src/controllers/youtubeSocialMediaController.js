const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { hasPermission } = require('../utilities/permissions');

const youtubeUploadController = () => {
  const uploadVideo = async (req, res) => {
    try {
      console.log('===== Incoming Request =====');
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);

      // Get requestor from req.body or req.requestor for compatibility with form-data
      const requestor = req.body.requestor || req.requestor;
      if (!requestor || requestor.role !== 'Owner') {
        return res.status(403).json({ error: 'Only Owner can upload videos to YouTube' });
      }

      console.log('Requestor:', requestor);

      if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
      }

      const {
        title,
        description,
        tags,
        categoryId,
        privacyStatus,
        accessToken
      } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
      }

      const filePath = req.file.path;
      console.log('Resolved file path:', filePath);

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const videoStream = fs.createReadStream(filePath);

      console.log('Uploading to YouTube with details:', {
        title,
        description,
        tags,
        categoryId,
        privacyStatus,
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
      // Output detailed error information for debugging
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed', details: error.message, stack: error.stack });
    }
  };

  return { uploadVideo };
};

module.exports = youtubeUploadController;
