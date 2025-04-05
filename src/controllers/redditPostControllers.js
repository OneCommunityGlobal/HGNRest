const axios = require('axios');
const schedule = require('node-schedule');

// Store scheduled jobs in memory
const scheduledJobs = new Map();

// Importing FormData for image upload
const FormData = require('form-data');

const redditPostController = () => {
  const publishToReddit = async (title, text, subreddit, mediaFiles, accessToken) => {
    try {
      // Check if this is a media post or text post
      const hasMedia = mediaFiles && mediaFiles.length > 0;

      if (!hasMedia) {
        // Text post - simpler process
        const postData = {
          title,
          text,
          sr: subreddit,
          kind: 'self', // self post
        };

        const postResponse = await axios.post(
          'https://oauth.reddit.com/api/submit',
          new URLSearchParams(postData),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );

        if (!postResponse.data.success) {
          throw new Error('Failed to create Reddit text post');
        }

        return {
          success: true,
          postUrl: postResponse.data.data.url,
          postId: postResponse.data.data.id,
        };
      }
      // Image/Media post - need to upload media first, then create post with it
      // We'll handle the first image - Reddit typically only supports one image per post via API
      const file = mediaFiles[0];

      // 1. Get image upload URL from Reddit
      const uploadUrlResponse = await axios.post(
        'https://oauth.reddit.com/api/media/asset.json',
        new URLSearchParams({
          filepath: file.originalname,
        }),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (!uploadUrlResponse.data || !uploadUrlResponse.data.args) {
        throw new Error('Failed to get media upload URL from Reddit');
      }

      const { action, fields } = uploadUrlResponse.data.args;

      // 2. Upload the image to the S3 endpoint Reddit provided
      const formData = new FormData();

      // Add all the fields Reddit provided
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Add the actual file content - using buffer directly instead of Blob for Node.js compatibility
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      // Upload to S3
      const uploadResponse = await axios.post(action, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.status !== 201 && uploadResponse.status !== 200) {
        throw new Error(`Failed to upload media: ${uploadResponse.status}`);
      }

      // 3. Submit the post with the uploaded media
      const postData = {
        title,
        sr: subreddit,
        kind: 'image', // image post
        url: fields.key, // Use the S3 key as the URL
        text: text || '', // Optional text
      };

      const postResponse = await axios.post(
        'https://oauth.reddit.com/api/submit',
        new URLSearchParams(postData),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (!postResponse.data.success) {
        throw new Error('Failed to create Reddit post with media');
      }

      return {
        success: true,
        postUrl: postResponse.data.data.url,
        postId: postResponse.data.data.id,
      };
    } catch (error) {
      console.error('Error publishing to Reddit:', error);
      throw error;
    }
  };

  const getScheduledPosts = (req, res) => {
    try {
      // Convert scheduled jobs to array format for response
      const scheduledPostsInfo = Array.from(scheduledJobs.entries()).map(([jobId, data]) => ({
        jobId,
        title: data.title,
        text: data.text,
        subreddit: data.subreddit,
        scheduleTime: data.scheduleTime,
        mediaFiles: data.mediaFiles || [],
      }));

      res.status(200).json({
        success: true,
        posts: scheduledPostsInfo,
      });
    } catch (error) {
      console.error('Error getting scheduled posts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduled posts',
        error: error.message,
      });
    }
  };

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

      const { title, text, subreddit, scheduleTime } = req.body;
      const mediaFiles = req.files;

      // Get access token using client credentials
      const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET } = process.env;
      const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');

      const tokenResponse = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const accessToken = tokenResponse.data.access_token;

      // Validate inputs
      if (!title || !subreddit) {
        console.log('Validation failed');
        return res.status(400).json({
          success: false,
          message: 'Title and subreddit are required',
        });
      }

      // Handle scheduled posts
      if (scheduleTime) {
        console.log('Scheduling post for:', new Date(scheduleTime));
        const scheduledDateTime = new Date(scheduleTime);
        if (scheduledDateTime <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Schedule time must be in the future',
          });
        }

        // Validate scheduling timeframe (maximum 6 months in advance)
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

        if (scheduledDateTime > sixMonthsFromNow) {
          return res.status(400).json({
            success: false,
            message: 'Schedule time cannot be more than 6 months in advance',
          });
        }

        const jobId = `reddit-post-${Date.now()}`;
        const job = schedule.scheduleJob(scheduledDateTime, async () => {
          try {
            console.log('Executing scheduled post:', jobId);
            // Get a fresh access token when executing the scheduled job
            const newTokenResponse = await axios.post(
              'https://www.reddit.com/api/v1/access_token',
              new URLSearchParams({ grant_type: 'client_credentials' }),
              {
                headers: {
                  Authorization: `Basic ${auth}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              },
            );
            const freshAccessToken = newTokenResponse.data.access_token;

            // The actual media files won't be available at scheduled time, just their metadata
            // For a complete solution, we would need to store the actual file data in a database
            const result = await publishToReddit(
              title,
              text,
              subreddit,
              mediaFiles,
              freshAccessToken,
            );
            console.log('Scheduled post published successfully:', result);
            scheduledJobs.delete(jobId);
          } catch (error) {
            console.error('Scheduled post error:', error);
          }
        });

        scheduledJobs.set(jobId, {
          job,
          title,
          text,
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

      // Handle immediate posts
      console.log('Publishing post immediately');
      const postResult = await publishToReddit(title, text, subreddit, mediaFiles, accessToken);

      console.log('Post published successfully:', postResult);
      res.status(200).json({
        success: true,
        message: 'Posted successfully to Reddit',
        postUrl: postResult.postUrl,
        postId: postResult.postId,
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

  const cancelScheduledPost = async (req, res) => {
    try {
      const { jobId } = req.params;
      const scheduledPost = scheduledJobs.get(jobId);

      if (!scheduledPost) {
        return res.status(404).json({
          success: false,
          message: 'Scheduled post not found',
        });
      }

      scheduledPost.job.cancel();
      scheduledJobs.delete(jobId);

      res.status(200).json({
        success: true,
        message: 'Scheduled post cancelled successfully',
      });
    } catch (error) {
      console.error('Error cancelling scheduled post:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel scheduled post',
        error: error.message,
      });
    }
  };

  return {
    postToReddit,
    getScheduledPosts,
    cancelScheduledPost,
  };
};

module.exports = redditPostController;
