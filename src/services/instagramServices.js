const axios = require('axios');

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const createMediaContainer = async ({
  instagramAccountId,
  accessToken,
  caption,
  mediaUrl,
  mediaType,
}) => {
  const endpoint = `${GRAPH_API_URL}/${instagramAccountId}/media`;

  const body = {
    caption,
    access_token: accessToken,
  };

  if (mediaType === 'VIDEO') {
    body.media_type = 'REELS';
    body.video_url = mediaUrl;
  } else {
    body.image_url = mediaUrl;
  }

  const response = await axios.post(endpoint, null, {
    params: body,
    timeout: 30000,
  });

  return response.data;
};

const waitForContainerReady = async ({
  creationId,
  accessToken,
  maxAttempts = 10,
  delayMs = 2000,
}) => {
  const endpoint = `${GRAPH_API_URL}/${creationId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await axios.get(endpoint, {
      params: {
        fields: 'status_code',
        access_token: accessToken,
      },
      timeout: 15000,
    });

    const { status_code: statusCode } = response.data;

    if (statusCode === 'FINISHED') {
      return true;
    }

    if (statusCode === 'ERROR') {
      throw new Error('Instagram media processing failed.');
    }

    // statusCode is likely 'IN_PROGRESS' — wait and retry
    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  throw new Error('Instagram media was not ready in time.');
};

const publishMediaContainer = async ({ instagramAccountId, accessToken, creationId }) => {
  const endpoint = `${GRAPH_API_URL}/${instagramAccountId}/media_publish`;

  const response = await axios.post(endpoint, null, {
    params: {
      creation_id: creationId,
      access_token: accessToken,
    },
    timeout: 30000,
  });

  return response.data;
};

const getMediaDetails = async ({ mediaId, accessToken }) => {
  const endpoint = `${GRAPH_API_URL}/${mediaId}`;

  const response = await axios.get(endpoint, {
    params: {
      fields: 'id,permalink,media_type,timestamp',
      access_token: accessToken,
    },
    timeout: 15000,
  });

  return response.data;
};

const publishInstagramPost = async ({
  instagramAccountId,
  accessToken,
  caption,
  mediaUrl,
  mediaType,
}) => {
  const container = await createMediaContainer({
    instagramAccountId,
    accessToken,
    caption,
    mediaUrl,
    mediaType,
  });

  const creationId = container.id;

  if (!creationId) {
    throw new Error('Instagram did not return a creation ID.');
  }
  await waitForContainerReady({ creationId, accessToken });
  const published = await publishMediaContainer({
    instagramAccountId,
    accessToken,
    creationId,
  });

  const instagramMediaId = published.id;

  if (!instagramMediaId) {
    throw new Error('Instagram did not return a media ID.');
  }

  const mediaDetails = await getMediaDetails({
    mediaId: instagramMediaId,
    accessToken,
  });

  return {
    creationId,
    instagramMediaId,
    permalink: mediaDetails.permalink || null,
    mediaType: mediaDetails.media_type || mediaType,
  };
};

module.exports = {
  createMediaContainer,
  waitForContainerReady,
  publishMediaContainer,
  getMediaDetails,
  publishInstagramPost,
};
