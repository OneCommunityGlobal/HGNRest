const axios = require('axios');
const schedule = require('node-schedule');
const ImgurPost = require('../models/imgurPosts');

const IMGUR_API_ENDPOINT = 'https://api.imgur.com/3';
const { IMGUR_CLIENT_ID } = process.env;
const { IMGUR_ACCESS_TOKEN } = process.env;
const { IMGUR_REFRESH_TOKEN } = process.env;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Summarize media files for API responses
 */
const summarizeMediaFiles = (mediaFiles = []) =>
  mediaFiles.map(({ originalname, mimetype, size }) => ({
    name: originalname,
    type: mimetype,
    size,
  }));

/**
 * Normalize media files for storage
 */
const normalizeMediaFiles = (mediaFiles = []) =>
  mediaFiles.map((file) => ({
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  }));

/**
 * Validate schedule time
 */
const validateScheduleTime = (scheduleTime) => {
  if (!scheduleTime) {
    return { scheduledDateTime: null };
  }

  const scheduledDateTime = new Date(scheduleTime);
  if (Number.isNaN(scheduledDateTime.getTime())) {
    return { error: 'Schedule time is invalid' };
  }

  if (scheduledDateTime <= new Date()) {
    return { error: 'Schedule time must be in the future' };
  }

  return { scheduledDateTime };
};

/**
 * Get authorization headers for Imgur API
 */
const getAuthHeaders = (accessToken = IMGUR_ACCESS_TOKEN) => {
  if (!accessToken && !IMGUR_CLIENT_ID) {
    throw new Error('Imgur authorization credentials not configured');
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (IMGUR_CLIENT_ID) {
    headers.Authorization = `Client-ID ${IMGUR_CLIENT_ID}`;
  }

  return headers;
};

/**
 * Upload image to Imgur and return image hash
 */
const uploadImageToImgur = async (imageBuffer, title = '') => {
  try {
    const base64Image = imageBuffer.toString('base64');

    const formData = {
      image: base64Image,
      type: 'base64',
      title,
    };

    const response = await axios.post(`${IMGUR_API_ENDPOINT}/upload`, formData, {
      headers: getAuthHeaders(),
    });

    if (!response.data.success) {
      throw new Error(`Imgur upload failed: ${response.data.data.error}`);
    }

    return response.data.data.id; // Returns the image hash/id
  } catch (err) {
    console.error('Image upload to Imgur failed:', err.response?.data || err.message);
    throw new Error(`Failed to upload image to Imgur: ${err.message}`);
  }
};

/**
 * Create an album on Imgur
 */
const createImgurAlbum = async (title, description = '') => {
  try {
    const response = await axios.post(
      `${IMGUR_API_ENDPOINT}/album`,
      {
        title,
        description,
      },
      {
        headers: getAuthHeaders(),
      },
    );

    if (!response.data.success) {
      throw new Error(`Album creation failed: ${response.data.data.error}`);
    }

    return response.data.data.id;
  } catch (err) {
    console.error('Album creation on Imgur failed:', err.response?.data || err.message);
    throw new Error(`Failed to create Imgur album: ${err.message}`);
  }
};

/**
 * Add images to an Imgur album
 */
const addImagesToAlbum = async (albumId, imageIds) => {
  try {
    if (!imageIds || imageIds.length === 0) {
      return albumId; // No images to add
    }

    const response = await axios.post(
      `${IMGUR_API_ENDPOINT}/album/${albumId}/add`,
      {
        ids: imageIds,
      },
      {
        headers: getAuthHeaders(),
      },
    );

    if (!response.data.success) {
      throw new Error(`Failed to add images to album: ${response.data.data.error}`);
    }

    return albumId;
  } catch (err) {
    console.error('Failed to add images to album:', err.response?.data || err.message);
    throw new Error(`Failed to add images to Imgur album: ${err.message}`);
  }
};

/**
 * Publish post to Imgur
 */
const publishToImgur = async (title, description, mediaFiles, userId) => {
  try {
    let albumId = null;
    let imgurUrl = null;
    const uploadedImageIds = [];

    // Upload images and create album
    if (mediaFiles && mediaFiles.length > 0) {
      // Create album if multiple images or any image exists
      albumId = await createImgurAlbum(title, description);

      // Upload each image to the album
      for (const file of mediaFiles) {
        const imageId = await uploadImageToImgur(file.buffer, title);
        uploadedImageIds.push(imageId);
      }

      // Add images to album
      await addImagesToAlbum(albumId, uploadedImageIds);
      imgurUrl = `https://imgur.com/a/${albumId}`;
    } else {
      // Create album without images (can be added later)
      albumId = await createImgurAlbum(title, description);
      imgurUrl = `https://imgur.com/a/${albumId}`;
    }

    return {
      success: true,
      albumId,
      imgurUrl,
      imageIds: uploadedImageIds,
    };
  } catch (err) {
    console.error('Imgur publication failed:', err.message);
    throw err;
  }
};

/**
 * Execute a scheduled post
 */
const executeScheduledPost = async (postId, scheduledJobs) => {
  let postRecord = null;
  try {
    postRecord = await ImgurPost.findById(postId);
    if (!postRecord) {
      console.error(`Scheduled post not found: ${postId}`);
      return;
    }

    // Check status to avoid duplicate processing
    if (postRecord.status !== 'pending') {
      console.log(`Post ${postId} is already being processed or completed`);
      return;
    }

    // Mark as publishing
    postRecord.status = 'publishing';
    await postRecord.save();

    // Publish to Imgur
    const result = await publishToImgur(
      postRecord.title,
      postRecord.description,
      postRecord.images,
      postRecord.userId,
    );

    // Update record with success
    postRecord.status = 'posted';
    postRecord.remotePostId = result.albumId;
    postRecord.albumId = result.albumId;
    postRecord.imgurUrl = result.imgurUrl;
    postRecord.postedAt = new Date();
    postRecord.attempts += 1;
    await postRecord.save();

    console.log(`Successfully posted to Imgur: ${result.imgurUrl}`);
  } catch (err) {
    console.error(`Failed to execute scheduled post ${postId}:`, err.message);

    if (postRecord) {
      postRecord.status = 'failed';
      postRecord.lastError = err.message;
      postRecord.attempts += 1;
      postRecord.lockOwner = null;
      postRecord.lockedUntil = null;
      await postRecord.save();
    }
  } finally {
    // Clean up scheduled job reference
    scheduledJobs.delete(postId);
  }
};

/**
 * Create a scheduled job for a post
 */
const createScheduledJob = (postId, scheduledDateTime, scheduledJobs) => {
  const job = schedule.scheduleJob(scheduledDateTime, async () => {
    await executeScheduledPost(postId, scheduledJobs);
  });

  return job;
};

// ============================================================================
// CONTROLLER
// ============================================================================

const imgurPostController = () => {
  const scheduledJobs = new Map(); // Map to track running scheduled jobs

  /**
   * POST /imgur/post
   * Post immediately or schedule for later
   */
  const postToImgur = async (req, res) => {
    try {
      const { title, description, scheduleTime } = req.body;
      const userId = req.user?._id || req.body.userId;

      // Validate input
      if (!title || title.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Title is required',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      const mediaFiles = normalizeMediaFiles(req.files || []);

      // Validate schedule time if provided
      const { scheduledDateTime, error: timeError } = validateScheduleTime(scheduleTime);
      if (timeError) {
        return res.status(400).json({
          success: false,
          message: timeError,
        });
      }

      // If scheduled for later, save to database and create job
      if (scheduledDateTime) {
        const postRecord = await ImgurPost.create({
          userId,
          title,
          description,
          images: mediaFiles,
          scheduledTime: scheduledDateTime,
          status: 'pending',
        });

        // Create in-memory scheduled job
        const job = createScheduledJob(postRecord._id, scheduledDateTime, scheduledJobs);
        scheduledJobs.set(postRecord._id.toString(), {
          job,
          postId: postRecord._id,
          title,
          scheduledTime: scheduledDateTime,
        });

        return res.status(200).json({
          success: true,
          message: 'Post scheduled successfully',
          postId: postRecord._id,
          scheduledTime: scheduledDateTime,
        });
      }

      // Post immediately
      const result = await publishToImgur(title, description, mediaFiles, userId);

      // Save to database as posted
      const postRecord = await ImgurPost.create({
        userId,
        title,
        description,
        images: mediaFiles,
        scheduledTime: new Date(),
        status: 'posted',
        remotePostId: result.albumId,
        albumId: result.albumId,
        imgurUrl: result.imgurUrl,
        postedAt: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: 'Posted successfully to Imgur',
        postId: postRecord._id,
        albumId: result.albumId,
        imgurUrl: result.imgurUrl,
      });
    } catch (err) {
      console.error('Imgur post error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to post to Imgur',
      });
    }
  };

  /**
   * GET /imgur/posts
   * Get all scheduled posts (from database)
   */
  const getScheduledPosts = async (req, res) => {
    try {
      const userId = req.user?._id || req.query.userId;

      const query = { status: { $ne: 'posted' } };
      if (userId) {
        query.userId = userId;
      }

      const posts = await ImgurPost.find(query)
        .select('-images.buffer') // Exclude binary image buffers from response
        .sort({ scheduledTime: 1 });

      return res.status(200).json({
        success: true,
        posts,
      });
    } catch (err) {
      console.error('Error fetching scheduled posts:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch scheduled posts',
        error: err.message,
      });
    }
  };

  /**
   * DELETE /imgur/posts/:postId
   * Delete a scheduled post
   */
  const deleteScheduledPost = async (req, res) => {
    try {
      const { postId } = req.params;

      // Only pending posts can be deleted
      const result = await ImgurPost.deleteOne({
        _id: postId,
        status: { $in: ['pending'] },
      });

      if (!result.deletedCount) {
        return res.status(404).json({
          success: false,
          message: 'Scheduled post not found or already being published',
        });
      }

      // Cancel the scheduled job
      const job = scheduledJobs.get(postId);
      if (job && job.job) {
        job.job.cancel();
      }
      scheduledJobs.delete(postId);

      return res.status(200).json({
        success: true,
        message: 'Scheduled post deleted successfully',
      });
    } catch (err) {
      console.error('Error deleting scheduled post:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete scheduled post',
        error: err.message,
      });
    }
  };

  /**
   * PUT /imgur/posts/:postId
   * Update a scheduled post
   */
  const updateScheduledPost = async (req, res) => {
    try {
      const { postId } = req.params;
      const { title, description, scheduleTime } = req.body;
      const mediaFiles = normalizeMediaFiles(req.files || []);

      // Find the post
      const post = await ImgurPost.findOne({
        _id: postId,
        status: 'pending',
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Scheduled post not found or cannot be updated',
        });
      }

      // Update fields
      if (title) post.title = title;
      if (description) post.description = description;
      if (mediaFiles.length > 0) post.images = mediaFiles;

      // Update schedule time if provided
      if (scheduleTime) {
        const { scheduledDateTime, error: timeError } = validateScheduleTime(scheduleTime);
        if (timeError) {
          return res.status(400).json({
            success: false,
            message: timeError,
          });
        }

        post.scheduledTime = scheduledDateTime;

        // Cancel old job and create new one
        const oldJob = scheduledJobs.get(postId);
        if (oldJob && oldJob.job) {
          oldJob.job.cancel();
        }

        const newJob = createScheduledJob(postId, scheduledDateTime, scheduledJobs);
        scheduledJobs.set(postId, {
          job: newJob,
          postId,
          title: post.title,
          scheduledTime: scheduledDateTime,
        });
      }

      await post.save();

      return res.status(200).json({
        success: true,
        message: 'Post updated successfully',
        post,
      });
    } catch (err) {
      console.error('Error updating scheduled post:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to update scheduled post',
        error: err.message,
      });
    }
  };

  /**
   * POST /imgur/authorize
   * Handle Imgur OAuth authorization and store tokens
   */
  const authorizeImgur = async (req, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is required',
        });
      }

      if (!process.env.IMGUR_CLIENT_ID || !process.env.IMGUR_CLIENT_SECRET) {
        return res.status(500).json({
          success: false,
          message: 'Imgur OAuth not configured on server',
        });
      }

      // Exchange code for access token
      const response = await axios.post('https://api.imgur.com/oauth2/token', {
        client_id: process.env.IMGUR_CLIENT_ID,
        client_secret: process.env.IMGUR_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      });

      if (!response.data.access_token) {
        throw new Error('Failed to obtain access token from Imgur');
      }

      // Store tokens (implementation depends on your auth strategy)
      // This is a simplified example - you should store in user profile or secure storage
      console.log('Imgur authorization successful');

      return res.status(200).json({
        success: true,
        message: 'Authorization successful',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      });
    } catch (err) {
      console.error('Imgur authorization failed:', err.response?.data || err.message);
      return res.status(500).json({
        success: false,
        message: 'Authorization failed',
        error: err.message,
      });
    }
  };

  return {
    postToImgur,
    getScheduledPosts,
    deleteScheduledPost,
    updateScheduledPost,
    authorizeImgur,
  };
};

module.exports = imgurPostController;
