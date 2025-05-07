const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const youtubeUploadController = () => {
  const uploadVideo = async (req, res) => {
    try {
      console.log('===== Incoming Request =====');
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);

      const {
        accessToken,
        title,
        description,
        tags,
        categoryId,
        privacyStatus,
        localVideoPath
      } = req.body;

      if (!accessToken || !localVideoPath) {
        console.error('Missing accessToken or localVideoPath');
        return res.status(400).json({ error: 'Access token and local video path are required' });
      }

      const filePath = path.resolve(localVideoPath);
      if (!fs.existsSync(filePath)) {
        console.error('Video file not found at path:', filePath);
        return res.status(400).json({ error: 'Video file not found at path: ' + filePath });
      }

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
            tags: tags || [],
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

      console.log('YouTube response:', response.data);

      res.status(200).json({
        message: 'Video uploaded successfully',
        videoId: response.data.id,
        url: `https://www.youtube.com/watch?v=${response.data.id}`,
      });
    } catch (error) {
      console.error('Upload error:', error.response?.data || error.message || error);
      res.status(500).json({ error: 'Upload failed', details: error.message });
    }
  };


  return { uploadVideo };
};

module.exports = youtubeUploadController;
