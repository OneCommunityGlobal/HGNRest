const axios = require('axios');
const schedule = require('node-schedule');

const summarizeMediaFiles = (mediaFiles = []) =>
  mediaFiles.map(({ originalname, mimetype, size }) => ({
    name: originalname,
    type: mimetype,
    size,
  }));

const normalizeMediaFiles = (mediaFiles = []) =>
  mediaFiles.map((file) => ({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  }));

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

const publishToLinkedIn = async (content, mediaFiles, organizationUrn, accessToken) => {
  const uploadedAssets = await Promise.all(
    (mediaFiles || []).map(async (file) => {
      const isVideo = file.mimetype.includes('video');
      const recipes = isVideo
        ? ['urn:li:digitalmediaRecipe:feedshare-video']
        : ['urn:li:digitalmediaRecipe:feedshare-image'];

      const registerResponse = await axios.post(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
          registerUploadRequest: {
            recipes,
            owner: organizationUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const { uploadUrl } =
        registerResponse.data.value.uploadMechanism[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ];
      const { asset } = registerResponse.data.value;
      const parsedUploadUrl = new URL(uploadUrl);
      const uploadHostname = parsedUploadUrl.hostname.toLowerCase();
      const isTrustedLinkedInUploadHost =
        parsedUploadUrl.protocol === 'https:' &&
        (uploadHostname.endsWith('.linkedin.com') || uploadHostname.endsWith('.licdn.com'));

      if (!isTrustedLinkedInUploadHost) {
        throw new Error('Received an invalid LinkedIn upload URL');
      }

      await axios.put(parsedUploadUrl.toString(), file.buffer, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': file.mimetype,
          'Content-Length': file.buffer.length,
        },
      });

      return asset;
    }),
  );

  let shareMediaCategory = 'NONE';
  if (uploadedAssets.length > 0) {
    shareMediaCategory = mediaFiles[0].mimetype.includes('video') ? 'VIDEO' : 'IMAGE';
  }

  const postData = {
    author: organizationUrn,
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

  const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  return response.data;
};

const createScheduledJob = (
  jobId,
  content,
  scheduledDateTime,
  mediaFiles,
  organizationUrn,
  accessToken,
  scheduledJobs,
) =>
  schedule.scheduleJob(scheduledDateTime, async () => {
    try {
      await publishToLinkedIn(content, mediaFiles, organizationUrn, accessToken);
      scheduledJobs.delete(jobId);
    } catch (error) {
      console.error('Scheduled LinkedIn post failed:', error.response?.data || error.message);
    }
  });

const linkedinPostController = () => {
  const scheduledJobs = new Map();

  const getScheduledPosts = (req, res) => {
    try {
      const scheduledPosts = Array.from(scheduledJobs.entries()).map(([jobId, data]) => ({
        jobId,
        content: data.content,
        scheduleTime: data.scheduleTime,
        mediaFiles: summarizeMediaFiles(data.mediaFiles),
      }));

      return res.status(200).json({
        success: true,
        scheduledPosts,
      });
    } catch (error) {
      console.error('Error getting scheduled posts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get scheduled posts',
        error: error.message,
      });
    }
  };

  const postToLinkedin = async (req, res) => {
    try {
      const { content, scheduleTime } = req.body;
      const mediaFiles = normalizeMediaFiles(req.files || []);
      const { ORGANIZATION_URN: organizationUrn, LINKEDIN_ACCESS_TOKEN: accessToken } = process.env;

      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Content is required',
        });
      }

      if (!organizationUrn || !accessToken) {
        return res.status(400).json({
          success: false,
          message: 'Missing required environment variables.',
        });
      }

      const { scheduledDateTime, error } = validateScheduleTime(scheduleTime);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error,
        });
      }

      if (scheduledDateTime) {
        const jobId = `linkedin-post-${Date.now()}`;
        const job = createScheduledJob(
          jobId,
          content,
          scheduledDateTime,
          mediaFiles,
          organizationUrn,
          accessToken,
          scheduledJobs,
        );

        scheduledJobs.set(jobId, {
          job,
          content,
          scheduleTime: scheduledDateTime,
          mediaFiles,
        });

        return res.status(200).json({
          success: true,
          message: 'Post scheduled successfully',
          scheduledTime: scheduledDateTime,
          jobId,
        });
      }

      await publishToLinkedIn(content, mediaFiles, organizationUrn, accessToken);

      return res.status(200).json({
        success: true,
        message: 'Posted successfully to LinkedIn',
      });
    } catch (error) {
      console.error('LinkedIn post error:', error.response?.data || error.message);
      return res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || 'Failed to post to LinkedIn',
        error: error.response?.data || error.message,
      });
    }
  };

  const deleteScheduledPost = (req, res) => {
    const { jobId } = req.params;

    if (!scheduledJobs.has(jobId)) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled post not found',
      });
    }

    const { job } = scheduledJobs.get(jobId);
    if (job) {
      job.cancel();
    }

    scheduledJobs.delete(jobId);

    return res.status(200).json({
      success: true,
      message: 'Scheduled post deleted successfully',
    });
  };

  const updateScheduledPost = (req, res) => {
    const { jobId } = req.params;
    const { content, scheduleTime } = req.body;
    const { ORGANIZATION_URN: organizationUrn, LINKEDIN_ACCESS_TOKEN: accessToken } = process.env;

    if (!scheduledJobs.has(jobId)) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled post not found',
      });
    }

    const previousJob = scheduledJobs.get(jobId);
    const { scheduledDateTime, error } = validateScheduleTime(
      scheduleTime || previousJob.scheduleTime,
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    if (previousJob.job) {
      previousJob.job.cancel();
    }

    const mediaFiles =
      req.files && req.files.length > 0
        ? normalizeMediaFiles(req.files)
        : previousJob.mediaFiles || [];
    const nextContent = content || previousJob.content;
    const job = createScheduledJob(
      jobId,
      nextContent,
      scheduledDateTime,
      mediaFiles,
      organizationUrn,
      accessToken,
      scheduledJobs,
    );

    scheduledJobs.set(jobId, {
      job,
      content: nextContent,
      scheduleTime: scheduledDateTime,
      mediaFiles,
    });

    return res.status(200).json({
      success: true,
      message: 'Scheduled post updated successfully',
    });
  };

  return {
    postToLinkedin,
    getScheduledPosts,
    deleteScheduledPost,
    updateScheduledPost,
  };
};

module.exports = linkedinPostController;
