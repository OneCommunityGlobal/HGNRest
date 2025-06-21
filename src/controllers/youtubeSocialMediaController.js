const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { getYoutubeAccountById } = require('../utilities/youtubeAccountUtil');
const YoutubeUploadHistory = require('../models/youtubeUploadHistory');
const ScheduledYoutubeUpload = require('../models/scheduledYoutubeUpload');

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
      const {requestor} = req;
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
        scheduledTime,
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

      // If scheduledTime is provided, save as a scheduled upload and return
      if (scheduledTime) {
        const scheduleDate = new Date(scheduledTime);
        if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
          return res.status(400).json({
            error: 'Invalid scheduled time.',
            details: `The scheduled time must be in the future. You provided (UTC): ${scheduleDate.toUTCString()}. The current server time (UTC) is: ${new Date().toUTCString()}.`,
          });
        }

        const newScheduledUpload = new ScheduledYoutubeUpload({
          youtubeAccountId,
          videoPath: req.file.path,
          title,
          description,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
          privacyStatus: privacyStatus || 'private',
          scheduledTime: scheduleDate,
          status: 'pending',
          uploadedBy: requestor.requestorId,
        });

        await newScheduledUpload.save();

        return res.status(200).json({
          message: 'Video scheduled for upload successfully',
          details: newScheduledUpload,
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
        status: response.data.status.uploadStatus,
      });

      await uploadHistory.save();

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

  const getUploadHistory = async (req, res) => {
    console.log('==== getUploadHistory controller called ====');
    try {
      const { youtubeAccountId } = req.query;

      if (!youtubeAccountId) {
        return res.status(400).json({ error: 'youtubeAccountId is required' });
      }

      const { requestor } = req;
      if (!requestor || requestor.role !== 'Owner') {
        return res.status(403).json({ error: 'Only Owner can get YouTube upload history' });
      }

      const account = await getYoutubeAccountById(youtubeAccountId);

      // If no real account is found in DB, it might be a test account.
      // For test accounts, we fetch history from our local DB.
      if (!account) {
        console.log(
          `No real account found for "${youtubeAccountId}". Assuming it's a test account and fetching from local DB.`,
        );
        const history = await YoutubeUploadHistory.find({ youtubeAccountId })
          .sort({ uploadDate: -1 })
          .limit(25);
        return res.status(200).json(history);
      }

      // If it IS a real account, we MUST fetch from the YouTube API.
      // Do not fall back to local DB on failure.
      try {
        const oauth2Client = new google.auth.OAuth2(
          account.clientId,
          account.clientSecret,
          account.redirectUri,
        );
        oauth2Client.setCredentials({ refresh_token: account.refreshToken });
        await oauth2Client.getAccessToken();

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        const channelsResponse = await youtube.channels.list({
          part: 'contentDetails',
          mine: true,
        });

        if (!channelsResponse.data.items || channelsResponse.data.items.length === 0) {
          return res.status(200).json([]);
        }

        const uploadsPlaylistId =
          channelsResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

        const playlistResponse = await youtube.playlistItems.list({
          playlistId: uploadsPlaylistId,
          part: 'snippet',
          maxResults: 50,
        });

        // The YouTube API response for playlistItems needs to be mapped to match the schema
        // our frontend expects (which is based on our YoutubeUploadHistory model)
        const formattedHistory = playlistResponse.data.items.map(item => ({
          _id: item.id,
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          publishedAt: item.snippet.publishedAt,
          thumbnailUrl:
            item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
          status: 'completed',
          youtubeAccountId,
        }));

        return res.status(200).json(formattedHistory);
      } catch (apiError) {
        console.error('YouTube API call failed for real account:', apiError.message);
        // Do NOT fall back to local DB. Return an error.
        return res.status(500).json({
          error: 'Failed to fetch video history from YouTube.',
          details: `The API call failed with message: ${apiError.message}. This could be due to an issue with API permissions.`,
        });
      }
    } catch (error) {
      console.error('Get upload history error:', error);
      res.status(500).json({
        error: 'Failed to fetch upload history',
        details: error.message,
      });
    }
  };

  const getScheduledUploads = async (req, res) => {
    console.log('==== getScheduledUploads controller called ====');
    try {
      const { youtubeAccountId } = req.query;

      if (!youtubeAccountId) {
        return res.status(400).json({ error: 'youtubeAccountId is required' });
      }

      // Only allow Owner to get scheduled uploads
      const {requestor} = req;
      if (!requestor || requestor.role !== 'Owner') {
        return res.status(403).json({ error: 'Only Owner can get YouTube scheduled uploads' });
      }

      const scheduledUploads = await ScheduledYoutubeUpload.find({
        youtubeAccountId,
        status: 'pending',
        scheduledTime: { $gt: new Date() },
      })
        .sort({ scheduledTime: 1 })
        .limit(25);

      res.status(200).json(scheduledUploads);

    } catch (error) {
      console.error('Get scheduled uploads error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch scheduled uploads', 
        details: error.message 
      });
    }
  };

  return { uploadVideo, getUploadHistory, getScheduledUploads };
};

module.exports = youtubeUploadController;
