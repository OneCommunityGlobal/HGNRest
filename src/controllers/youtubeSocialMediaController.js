const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { hasPermission } = require('../utilities/permissions');
const { getYoutubeAccountById } = require('../utilities/youtubeAccountUtil');
const ScheduledYoutubeUpload = require('../models/scheduledYoutubeUpload');
const YoutubeUploadHistory = require('../models/youtubeUploadHistory');

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
        privacyStatus,
        scheduledTime
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

      const filePath = req.file.path;

      // If scheduled upload
      if (scheduledTime) {
        const scheduledDate = new Date(scheduledTime);
        if (scheduledDate < new Date()) {
          return res.status(400).json({ error: 'Scheduled time cannot be earlier than current time' });
        }

        // Create scheduled upload task
        const scheduledUpload = new ScheduledYoutubeUpload({
          youtubeAccountId,
          videoPath: filePath,
          title,
          description,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
          privacyStatus: privacyStatus || 'private',
          scheduledTime: scheduledDate
        });

        await scheduledUpload.save();

        // Record in history
        await YoutubeUploadHistory.create({
          youtubeAccountId,
          title,
          description,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
          privacyStatus: privacyStatus || 'private',
          status: 'scheduled',
          scheduledTime: scheduledDate
        });

        return res.status(200).json({
          message: 'Video scheduled successfully',
          scheduledTime: scheduledDate,
          uploadId: scheduledUpload._id
        });
      }

      // Immediate upload
      const oauth2Client = new google.auth.OAuth2(
        account.clientId,
        account.clientSecret,
        account.redirectUri
      );
      oauth2Client.setCredentials({ refresh_token: account.refreshToken });
      await oauth2Client.getAccessToken();

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
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

      // Record successful upload in history
      await YoutubeUploadHistory.create({
        youtubeAccountId,
        title,
        description,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        privacyStatus: privacyStatus || 'private',
        videoId: response.data.id,
        status: 'completed'
      });

      res.status(200).json({
        message: 'Video uploaded successfully',
        videoId: response.data.id,
        url: `https://www.youtube.com/watch?v=${response.data.id}`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      
      // Record failed upload in history
      if (req.body.youtubeAccountId && req.body.title) {
        await YoutubeUploadHistory.create({
          youtubeAccountId: req.body.youtubeAccountId,
          title: req.body.title,
          description: req.body.description,
          tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
          privacyStatus: req.body.privacyStatus || 'private',
          status: 'failed',
          error: error.message
        });
      }

      res.status(500).json({ 
        error: 'Upload failed', 
        details: error.message,
        stack: error.stack 
      });
    }
  };

  const getUploadHistory = async (req, res) => {
    try {
      const history = await YoutubeUploadHistory.find()
        .sort({ uploadTime: -1 })
        .limit(50);
      
      res.json(history);
    } catch (error) {
      console.error('Error fetching upload history:', error);
      res.status(500).json({ error: 'Failed to fetch upload history' });
    }
  };

  return { uploadVideo, getUploadHistory };
};

module.exports = youtubeUploadController;
