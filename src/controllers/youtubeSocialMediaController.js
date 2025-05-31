const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { hasPermission } = require('../utilities/permissions');

// Google OAuth2 config for testing
const CLIENT_ID = '632550011285-blbthkovp8eagnr3bhcajmbijdk50i5q.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = '1//04EerinWLuF0jCgYIARAAGAQSNwF-L9Ird5qp0F3iDwxPJ87Yoox9yNcD4e4agZuVaTTnLEGPe-0t8GejxeYlH-UGvP7ot5rUlbo';

const youtubeUploadController = () => {
  const uploadVideo = async (req, res) => {
    try {
      console.log('===== Incoming Request =====');
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);

      // Only allow Owner to upload
      const requestor = req.body.requestor || req.requestor;
      if (!requestor || requestor.role !== 'Owner') {
        return res.status(403).json({ error: 'Only Owner can upload videos to YouTube' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
      }

      const {
        title,
        description,
        tags,
        categoryId,
        privacyStatus
      } = req.body;

      // Use refresh token to automatically get access token
      const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
      await oauth2Client.getAccessToken(); // Automatically refresh access token

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const filePath = req.file.path;
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
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed', details: error.message, stack: error.stack });
    }
  };

  return { uploadVideo };
};

module.exports = youtubeUploadController;
