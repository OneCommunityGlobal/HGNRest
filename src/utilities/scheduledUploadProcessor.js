const { google } = require('googleapis');
const fs = require('fs');
const { getYoutubeAccountById } = require('./youtubeAccountUtil');
const ScheduledYoutubeUpload = require('../models/scheduledYoutubeUpload');
const YoutubeUploadHistory = require('../models/youtubeUploadHistory');

async function processScheduledUploads() {
  try {
    // Find all pending scheduled upload tasks
    const pendingUploads = await ScheduledYoutubeUpload.find({
      status: 'pending',
      scheduledTime: { $lte: new Date() }
    });

    for (const upload of pendingUploads) {
      try {
        // Update status to processing
        upload.status = 'processing';
        await upload.save();

        // Get YouTube account info
        const account = await getYoutubeAccountById(upload.youtubeAccountId);
        if (!account) {
          throw new Error(`YouTube account not found: ${upload.youtubeAccountId}`);
        }

        // Set up OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
          account.clientId,
          account.clientSecret,
          account.redirectUri
        );
        oauth2Client.setCredentials({ refresh_token: account.refreshToken });
        await oauth2Client.getAccessToken();

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // Check if video file exists
        if (!fs.existsSync(upload.videoPath)) {
          throw new Error('Video file does not exist');
        }

        const videoStream = fs.createReadStream(upload.videoPath);

        // Upload video to YouTube
        const response = await youtube.videos.insert({
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: upload.title,
              description: upload.description,
              tags: upload.tags,
              defaultLanguage: 'en',
              defaultAudioLanguage: 'en'
            },
            status: {
              privacyStatus: upload.privacyStatus,
            },
          },
          media: {
            body: videoStream,
          },
        });

        // Update status to completed
        upload.status = 'completed';
        await upload.save();

        // Record successful upload in history
        await YoutubeUploadHistory.create({
          youtubeAccountId: upload.youtubeAccountId,
          title: upload.title,
          description: upload.description,
          tags: upload.tags,
          privacyStatus: upload.privacyStatus,
          videoId: response.data.id,
          status: 'completed',
          scheduledTime: upload.scheduledTime
        });

        // Delete temporary file
        fs.unlink(upload.videoPath, (err) => {
          if (err) console.error('Failed to delete temporary file:', err);
        });

        console.log(`Video ${upload.title} has been successfully published to YouTube`);
      } catch (error) {
        console.error(`Failed to process scheduled upload:`, error);
        upload.status = 'failed';
        upload.error = error.message;
        await upload.save();

        // Record failed upload in history
        await YoutubeUploadHistory.create({
          youtubeAccountId: upload.youtubeAccountId,
          title: upload.title,
          description: upload.description,
          tags: upload.tags,
          privacyStatus: upload.privacyStatus,
          status: 'failed',
          error: error.message,
          scheduledTime: upload.scheduledTime
        });
      }
    }
  } catch (error) {
    console.error('Error processing scheduled uploads:', error);
  }
}

// Check for pending scheduled uploads every minute
setInterval(processScheduledUploads, 60000);

module.exports = { processScheduledUploads }; 