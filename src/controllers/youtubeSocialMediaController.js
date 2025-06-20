const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
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

      // Store upload history in database
      const uploadHistory = new YoutubeUploadHistory({
        youtubeAccountId,
        videoId: response.data.id,
        title: response.data.snippet.title,
        description: response.data.snippet.description,
        tags: response.data.snippet.tags || [],
        privacyStatus: response.data.status.privacyStatus,
        categoryId: response.data.snippet.categoryId,
        channelId: response.data.snippet.channelId,
        channelTitle: response.data.snippet.channelTitle,
        publishedAt: response.data.snippet.publishedAt,
        thumbnailUrl: response.data.snippet.thumbnails?.default?.url,
        uploadedBy: requestor.requestorId,
        youtubeUrl: `https://www.youtube.com/watch?v=${response.data.id}`,
        status: response.data.status.uploadStatus || 'completed',
        uploadTime: new Date()
      });

      await uploadHistory.save();

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
    console.log('==== getUploadHistory controller called ====');
    try {
      const { youtubeAccountId } = req.query;

      if (!youtubeAccountId) {
        return res.status(400).json({ error: 'youtubeAccountId is required' });
      }

      // Only allow Owner to get upload history (same as upload video)
      const requestor = req.requestor;
      if (!requestor || requestor.role !== 'Owner') {
        return res.status(403).json({ error: 'Only Owner can get YouTube upload history' });
      }

      try {
        const account = await getYoutubeAccountById(youtubeAccountId);

        if (account) {
          // Real account logic
          const oauth2Client = new google.auth.OAuth2(
            account.clientId,
            account.clientSecret,
            account.redirectUri
          );
          oauth2Client.setCredentials({ refresh_token: account.refreshToken });
          await oauth2Client.getAccessToken();

          const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

          const response = await youtube.channels.list({
            part: 'contentDetails',
            mine: true
          });
          
          const uploadsPlaylistId = response.data.items[0].contentDetails.relatedPlaylists.uploads;

          const playlistResponse = await youtube.playlistItems.list({
            playlistId: uploadsPlaylistId,
            part: 'snippet',
            maxResults: 25
          });
          
          return res.status(200).json(playlistResponse.data.items);
        }

        // If no account found, assume it might be a test account or fallback for any other reason.
        console.log(`No real account found for "${youtubeAccountId}". Falling back to database history.`);
        const history = await YoutubeUploadHistory.find({ youtubeAccountId })
          .sort({ uploadTime: -1 })
          .limit(25);
        
        return res.status(200).json(history);

      } catch (apiError) {
        console.log('YouTube API failed or other error, falling back to database:', apiError.message);
        // Fallback to database
        const history = await YoutubeUploadHistory.find({ youtubeAccountId })
          .sort({ uploadTime: -1 })
          .limit(25);
        
        res.status(200).json(history);
      }

    } catch (error) {
      console.error('Get upload history error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch upload history', 
        details: error.message 
      });
    }
  };

  return { uploadVideo, getUploadHistory };
};

module.exports = youtubeUploadController;
