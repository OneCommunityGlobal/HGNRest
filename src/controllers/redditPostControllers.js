const axios = require('axios');
const schedule = require('node-schedule');
require('dotenv').config(); // Ensure .env variables are loaded

// Store scheduled posts in memory
const scheduledPosts = new Map();

// Function to obtain an access token using the client secret
const getRedditAccessToken = async () => {
  const {REDDIT_CLIENT_ID} = process.env;
  const {REDDIT_ACCESS_SECRET} = process.env;

  if (!REDDIT_CLIENT_ID || !REDDIT_ACCESS_SECRET) {
    throw new Error('Missing Reddit API credentials (REDDIT_CLIENT_ID or REDDIT_ACCESS_SECRET)');
  }

  const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_ACCESS_SECRET}`).toString('base64');

  try {
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reddit access token:', error.response?.data || error.message);
    throw new Error('Failed to get Reddit access token');
  }
};

// Function to publish a post to Reddit
const publishToReddit = async (title, content, subreddit, mediaFiles) => {
  const uploadedAssets = [];
  const ACCESS_TOKEN = await getRedditAccessToken(); // Get a fresh token

  if (mediaFiles && mediaFiles.length > 0) {
    for (const file of mediaFiles) {
      const isVideo = file.mimetype.includes('video');
      const uploadType = isVideo ? 'video' : 'image';

      // Upload media file to Reddit
      const formData = new FormData();
      formData.append('file', file.buffer, file.originalname);
      formData.append('upload_type', uploadType);

      const uploadResponse = await axios.post(
        'https://oauth.reddit.com/api/media/asset.json',
        formData,
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      uploadedAssets.push(uploadResponse.data.args.asset_id);
    }
  }

  // Prepare post data
  const postData = {
    sr: subreddit,
    title,
    kind: uploadedAssets.length > 0 ? 'image' : 'self',
    text: content,
    media_ids: uploadedAssets.length > 0 ? uploadedAssets : undefined,
  };

  // Submit post to Reddit
  await axios.post('https://oauth.reddit.com/api/submit', postData, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
};

// Retrieve all scheduled posts
const getScheduledPosts = (req, res) => {
  try {
    const scheduledPostsInfo = Array.from(scheduledPosts.entries()).map(([jobId, data]) => ({
      jobId,
      title: data.title,
      content: data.content,
      subreddit: data.subreddit,
      scheduleTime: data.scheduleTime,
      mediaFiles: data.mediaFiles || [],
    }));

    res.status(200).json({
      success: true,
      scheduledPosts: scheduledPostsInfo,
    });
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve scheduled posts',
      error: error.message,
    });
  }
};

// Function to handle Reddit post request
const postToReddit = async (req, res) => {
  try {
    console.log('Received Reddit post request:', {
      body: req.body,
      scheduleTime: req.body.scheduleTime,
      files: req.files?.map((f) => ({
        name: f.originalname,
        type: f.mimetype,
        size: f.size,
      })),
    });

    const { title, content, scheduleTime, subreddit } = req.body;
    const mediaFiles = req.files;

    if (!title || !subreddit) {
      return res.status(400).json({
        success: false,
        message: 'Title and subreddit are required',
      });
    }

    // Handle scheduled posts
    if (scheduleTime) {
      console.log('Scheduling post for:', new Date(scheduleTime));
      const scheduledDateTime = new Date(scheduleTime);

      // Ensure the scheduled time is in the future and within the next 6 months
      const maxScheduleDate = new Date();
      maxScheduleDate.setMonth(maxScheduleDate.getMonth() + 6);
      if (scheduledDateTime <= new Date() || scheduledDateTime > maxScheduleDate) {
        return res.status(400).json({
          success: false,
          message: 'Schedule time must be in the future and within the next 6 months',
        });
      }

      const jobId = `reddit-post-${Date.now()}`;
      const job = schedule.scheduleJob(scheduledDateTime, async () => {
        try {
          console.log('Executing scheduled Reddit post:', jobId);
          await publishToReddit(title, content, subreddit, mediaFiles);
          console.log('Scheduled post published successfully');
          scheduledPosts.delete(jobId);
        } catch (error) {
          console.error('Error publishing scheduled post:', error);
        }
      });

      scheduledPosts.set(jobId, {
        job,
        title,
        content,
        subreddit,
        scheduleTime: scheduledDateTime,
        mediaFiles: mediaFiles?.map((f) => ({
          name: f.originalname,
          type: f.mimetype,
          size: f.size,
        })),
      });

      console.log('Post scheduled successfully:', jobId);
      return res.status(200).json({
        success: true,
        message: 'Post scheduled successfully',
        scheduledTime: scheduledDateTime,
        jobId,
      });
    }

    // Handle immediate post publishing
    console.log('Publishing post immediately');
    await publishToReddit(title, content, subreddit, mediaFiles);

    console.log('Post published successfully');
    res.status(200).json({
      success: true,
      message: 'Posted successfully to Reddit',
    });
  } catch (error) {
    console.error('Reddit post error:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to post to Reddit',
      error: error.response?.data || error.message,
    });
  }
};

module.exports = () => ({
  postToReddit,
  getScheduledPosts,
});