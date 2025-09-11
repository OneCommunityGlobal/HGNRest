const axios = require('axios');
const schedule = require('node-schedule');

// Store scheduled jobs in memory
const scheduledJobs = new Map();

const linkedinPostController = () => {
  // Move publishToLinkedIn before it's used
  const axios = require('axios');

const publishToLinkedIn = async (content, mediaFiles, ORGANIZATION_URN, ACCESS_TOKEN) => {
  const uploadedAssets = [];

  if (mediaFiles && mediaFiles.length > 0) {
    const uploadPromises = mediaFiles.map(async (file) => {
      try {
        const isVideo = file.mimetype.includes('video');
        const recipes = isVideo
          ? ['urn:li:digitalmediaRecipe:feedshare-video']
          : ['urn:li:digitalmediaRecipe:feedshare-image'];

        const registerUploadRequest = {
          registerUploadRequest: {
            recipes,
            owner: ORGANIZATION_URN,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        };

        const registerResponse = await axios.post(
          'https://api.linkedin.com/v2/assets?action=registerUpload',
          registerUploadRequest,
          {
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const { uploadUrl } =
          registerResponse.data.value.uploadMechanism[
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
          ];
        const { asset } = registerResponse.data.value;

        console.log(`Uploading file: ${file.originalname}`);
        console.log(`Asset URN: ${asset}`);
        console.log(`Upload URL: ${uploadUrl}`);

        await axios.put(uploadUrl, file.buffer, {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': file.mimetype,
            'Content-Length': file.buffer.length,
          },
        });

        return asset;
      } catch (err) {
        console.error('Error uploading media:', err.response?.data || err.message);
        throw err; // Optionally skip or rethrow based on your preference
      }
    });

    try {
      const assets = await Promise.all(uploadPromises);
      uploadedAssets.push(...assets);
    } catch (err) {
      console.error('One or more media uploads failed.');
      return; // Optionally fail gracefully or skip post creation
    }
  }

  let shareMediaCategory = 'NONE';
  if (uploadedAssets.length > 0) {
    shareMediaCategory = mediaFiles[0].mimetype.includes('video') ? 'VIDEO' : 'IMAGE';
  }

  const postData = {
    author: ORGANIZATION_URN,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory,
        media: uploadedAssets.map((asset) => ({
          status: 'READY',
          media: asset,
        })),
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  try {
    const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    console.log('Post published successfully:', response.data);
  } catch (err) {
    console.error('Error creating post:', err.response?.data || err.message);
  }
};


  // Add getScheduledPosts controller method
  const getScheduledPosts = (req, res) => {
    try {
      // Convert scheduled jobs to array format for response
      const scheduledPostsInfo = Array.from(scheduledJobs.entries()).map(([jobId, data]) => ({
        jobId,
        content: data.content,
        scheduleTime: data.scheduleTime,
        mediaFiles: data.mediaFiles || [],
      }));

      res.status(200).json({
        success: true,
        scheduledPosts: scheduledPostsInfo,
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

  const postToLinkedin = async (req, res) => {
    try {
      console.log('Received LinkedIn post request:', {
        body: req.body,
        scheduleTime: req.body.scheduleTime,
        files: req.files?.map((f) => ({
          name: f.originalname,
          type: f.mimetype,
          size: f.size,
        })),
      });

      const { content, scheduleTime } = req.body;
      const mediaFiles = req.files;

      const { ORGANIZATION_URN, LINKEDIN_ACCESS_TOKEN: ACCESS_TOKEN } = process.env;

      // Validate inputs
      if (!content) {
        console.log('Content validation failed');
        return res.status(400).json({
          success: false,
          message: 'Content is required',
        });
      }

      if (!ORGANIZATION_URN || !ACCESS_TOKEN) {
        console.log('Missing environment variables');
        return res.status(400).json({
          success: false,
          message: 'Missing required environment variables.',
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

        const jobId = `linkedin-post-${Date.now()}`;
        const job = schedule.scheduleJob(scheduledDateTime, async () => {
          try {
            console.log('Executing scheduled post:', jobId);
            await publishToLinkedIn(content, mediaFiles, ORGANIZATION_URN, ACCESS_TOKEN);
            console.log('Scheduled post published successfully');
            scheduledJobs.delete(jobId);
          } catch (error) {
            console.error('Scheduled post error:', error);
          }
        });

        scheduledJobs.set(jobId, {
          job,
          content,
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
      await publishToLinkedIn(content, mediaFiles, ORGANIZATION_URN, ACCESS_TOKEN);

      console.log('Post published successfully');
      res.status(200).json({
        success: true,
        message: 'Posted successfully to LinkedIn',
      });
    } catch (error) {
      console.error('LinkedIn post error:', error);
      res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || 'Failed to post to LinkedIn',
        error: error.response?.data || error.message,
      });
    }
  };

 const deleteScheduledPost = (req, res) => {
  const jobId = req.params.jobId;
  console.log("reached here");

  if (!scheduledJobs.has(jobId)) {
    return res.status(404).json({
      success: false,
      message: 'Scheduled post not found',
    });
  }

  const jobData = scheduledJobs.get(jobId);
  if (jobData.job) {
    jobData.job.cancel(); // cancel the job if it's active
  }

  scheduledJobs.delete(jobId); // remove from map

  return res.status(200).json({
    success: true,
    message: 'Scheduled post deleted successfully',
  });
};


const updateScheduledPost = (req, res) => {
  const jobId = req.params.jobId;
  const { content, scheduleTime } = req.body;
  const newFiles = req.files;
  const { ORGANIZATION_URN, LINKEDIN_ACCESS_TOKEN: ACCESS_TOKEN } = process.env;

  if (!scheduledJobs.has(jobId)) {
    return res.status(404).json({
      success: false,
      message: 'Scheduled post not found',
    });
  }

  const prevJobData = scheduledJobs.get(jobId);

  // Cancel old job
  const oldJob = prevJobData.job;
  if (oldJob) oldJob.cancel();

  const scheduledDateTime = new Date(scheduleTime);
  if (scheduledDateTime <= new Date()) {
    return res.status(400).json({
      success: false,
      message: 'Schedule time must be in the future',
    });
  }

  let mediaToUse;

  if (newFiles && newFiles.length > 0) {
    // Use new uploaded media
    mediaToUse = newFiles.map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    }));
  } else {
    // Retain previous media
    mediaToUse = (prevJobData.mediaFiles || []).map((f) => ({
      ...f,
      buffer: f.buffer || Buffer.alloc(0), // fallback if missing buffer
    }));
  }

  const job = schedule.scheduleJob(scheduledDateTime, async () => {
    try {
      await publishToLinkedIn(content, mediaToUse, ORGANIZATION_URN, ACCESS_TOKEN);
      scheduledJobs.delete(jobId);
    } catch (err) {
      console.error('Error executing updated post:', err);
    }
  });

  scheduledJobs.set(jobId, {
    job,
    content,
    scheduleTime: scheduledDateTime,
    mediaFiles: mediaToUse,
  });

  return res.status(200).json({
    success: true,
    message: 'Scheduled post updated successfully',
  });
};




  // Return both controller methods
  return {
    postToLinkedin,
    getScheduledPosts,
    deleteScheduledPost,
    updateScheduledPost,
  };
};

module.exports = linkedinPostController;
