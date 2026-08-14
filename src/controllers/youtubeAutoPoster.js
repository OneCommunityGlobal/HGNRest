const fs = require('fs');
const { Readable } = require('stream');
const { google } = require('googleapis');
const { z } = require('zod');

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 5000;
const TAGS_MAX_LENGTH = 500;
const HTTP_STATUS_UPPER_BOUND = 600;
const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch?v=';

const preprocessMultipartBoolean = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

const multipartBoolean = (fieldName, defaultValue, required = false) => {
  const booleanSchema = z.boolean({
    error: (issue) =>
      issue.input === undefined ? `${fieldName} is required` : `${fieldName} must be true or false`,
  });
  const optionalBooleanSchema = required ? booleanSchema : booleanSchema.optional();
  return z.preprocess(
    preprocessMultipartBoolean,
    defaultValue === undefined
      ? optionalBooleanSchema
      : optionalBooleanSchema.default(defaultValue),
  );
};

const preprocessTags = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed.startsWith('[')) return trimmed.split(',');
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return value;
  }
};

const tagsSchema = z
  .preprocess(
    preprocessTags,
    z.array(z.string(), {
      error: 'tags must be a JSON array or comma-separated text',
    }),
  )
  .transform((tags) => tags.map((tag) => tag.trim()).filter(Boolean))
  .refine(
    (tags) => {
      const textLength = tags.reduce((length, tag) => length + tag.length, 0);
      return textLength + Math.max(tags.length - 1, 0) <= TAGS_MAX_LENGTH;
    },
    { message: `tags must not exceed ${TAGS_MAX_LENGTH} characters` },
  );

const optionalText = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().trim().min(1).optional(),
);

const youtubeMetadataSchema = z
  .object({
    title: z
      .string({ error: 'title is required' })
      .trim()
      .min(1, 'title is required')
      .max(TITLE_MAX_LENGTH, `title must not exceed ${TITLE_MAX_LENGTH} characters`),
    description: z
      .string({ error: 'description must be text' })
      .trim()
      .max(
        DESCRIPTION_MAX_LENGTH,
        `description must not exceed ${DESCRIPTION_MAX_LENGTH} characters`,
      )
      .default(''),
    categoryId: z.preprocess(
      (value) => (typeof value === 'number' ? String(value) : value),
      z
        .string({ error: 'categoryId is required' })
        .trim()
        .regex(/^\d+$/, 'categoryId must be a numeric YouTube category ID'),
    ),
    tags: tagsSchema,
    privacyStatus: z
      .enum(['private', 'unlisted', 'public'], {
        error: 'privacyStatus must be private, unlisted, or public',
      })
      .default('private'),
    madeForKids: multipartBoolean('madeForKids', undefined, true),
    publishAt: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.coerce.date({ error: 'publishAt must be a valid future date' }).optional(),
    ),
    notifySubscribers: multipartBoolean('notifySubscribers', false),
    embeddable: multipartBoolean('embeddable', true),
    publicStatsViewable: multipartBoolean('publicStatsViewable', true),
    containsSyntheticMedia: multipartBoolean('containsSyntheticMedia'),
    license: z
      .enum(['youtube', 'creativeCommon'], {
        error: 'license must be youtube or creativeCommon',
      })
      .default('youtube'),
    defaultLanguage: optionalText,
    defaultAudioLanguage: optionalText,
  })
  .superRefine((metadata, context) => {
    if (metadata.publishAt && metadata.publishAt <= new Date()) {
      context.addIssue({
        code: 'custom',
        path: ['publishAt'],
        message: 'publishAt must be a valid future date',
      });
    }
    if (metadata.publishAt && metadata.privacyStatus !== 'private') {
      context.addIssue({
        code: 'custom',
        path: ['privacyStatus'],
        message: 'privacyStatus must be private when publishAt is provided',
      });
    }
  })
  .transform((metadata) => ({
    ...metadata,
    publishAt: metadata.publishAt?.toISOString(),
  }));

const metadataJsonSchema = z.string().transform((value, context) => {
  try {
    const metadata = JSON.parse(value);
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error();
    return metadata;
  } catch (error) {
    context.addIssue({ code: 'custom', message: 'metadata must be valid JSON' });
    return z.NEVER;
  }
});

const parseMetadata = (body = {}) => {
  if (!body.metadata) return { ...body };

  const { metadata, ...individualFields } = body;
  const parsedMetadata =
    typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : z.object({ metadata: metadataJsonSchema }).parse({ metadata }).metadata;
  return { ...parsedMetadata, ...individualFields };
};

const normalizeUploadMetadata = (body) => youtubeMetadataSchema.parse(parseMetadata(body));

const videoFileSchema = z.unknown().superRefine((file, context) => {
  if (!file || typeof file !== 'object') {
    context.addIssue({ code: 'custom', path: ['video'], message: 'video is required' });
    return;
  }
  if (!file.mimetype || !file.mimetype.startsWith('video/')) {
    context.addIssue({
      code: 'custom',
      path: ['video'],
      message: 'video must be a supported video file',
    });
  }
  if ((typeof file.size === 'number' && file.size <= 0) || file.buffer?.length === 0) {
    context.addIssue({ code: 'custom', path: ['video'], message: 'video must not be empty' });
  }
  if (!file.buffer && !file.path && !file.stream) {
    context.addIssue({ code: 'custom', path: ['video'], message: 'video content is missing' });
  }
});

const validateVideoFile = (file) => videoFileSchema.parse(file);

const formatZodErrors = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));

const createVideoStream = (file) => {
  if (file.stream) return file.stream;
  if (file.path) return fs.createReadStream(file.path);
  return Readable.from([file.buffer]);
};

const createYoutubeClient = () => {
  const {
    YOUTUBE_CLIENT_ID: clientId,
    YOUTUBE_CLIENT_SECRET: clientSecret,
    YOUTUBE_REDIRECT_URI: redirectUri,
    YOUTUBE_REFRESH_TOKEN: refreshToken,
  } = process.env;

  const missingVariables = [
    ['YOUTUBE_CLIENT_ID', clientId],
    ['YOUTUBE_CLIENT_SECRET', clientSecret],
    ['YOUTUBE_REDIRECT_URI', redirectUri],
    ['YOUTUBE_REFRESH_TOKEN', refreshToken],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(`Missing YouTube OAuth configuration: ${missingVariables.join(', ')}`);
  }

  const oauthClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauthClient.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth: oauthClient });
};

const buildYoutubeRequestBody = (metadata) => {
  const snippet = {
    title: metadata.title,
    description: metadata.description,
    categoryId: metadata.categoryId,
  };
  if (metadata.tags.length > 0) snippet.tags = metadata.tags;
  if (metadata.defaultLanguage) snippet.defaultLanguage = metadata.defaultLanguage;
  if (metadata.defaultAudioLanguage) {
    snippet.defaultAudioLanguage = metadata.defaultAudioLanguage;
  }

  const status = {
    privacyStatus: metadata.privacyStatus,
    selfDeclaredMadeForKids: metadata.madeForKids,
    embeddable: metadata.embeddable,
    license: metadata.license,
    publicStatsViewable: metadata.publicStatsViewable,
  };
  if (metadata.publishAt) status.publishAt = metadata.publishAt;
  if (metadata.containsSyntheticMedia !== undefined) {
    status.containsSyntheticMedia = metadata.containsSyntheticMedia;
  }

  return { snippet, status };
};

const getYoutubeErrorMessage = (error) =>
  error.response?.data?.error?.message ||
  error.errors?.[0]?.message ||
  error.message ||
  'Failed to upload video to YouTube';

/**
 * Receives one multipart file named `video` and YouTube metadata supplied either
 * as a JSON `metadata` form field or as individual multipart text fields.
 */
const uploadVideo = async (req, res) => {
  try {
    validateVideoFile(req.file);
    const metadata = normalizeUploadMetadata(req.body || {});
    const youtube = createYoutubeClient();

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      notifySubscribers: metadata.notifySubscribers,
      requestBody: buildYoutubeRequestBody(metadata),
      media: {
        mimeType: req.file.mimetype,
        body: createVideoStream(req.file),
      },
    });

    const videoId = response?.data?.id;
    if (!videoId) {
      const uploadError = new Error('YouTube did not return a video ID');
      uploadError.statusCode = 502;
      throw uploadError;
    }

    return res.status(201).json({
      success: true,
      message: 'Video uploaded to YouTube successfully',
      video: {
        id: videoId,
        url: `${YOUTUBE_WATCH_URL}${videoId}`,
        title: response.data.snippet?.title || metadata.title,
        privacyStatus: response.data.status?.privacyStatus || metadata.privacyStatus,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatZodErrors(error);
      return res.status(400).json({
        success: false,
        message: errors[0].message,
        errors,
      });
    }

    const statusCode = error.response?.status || error.statusCode;
    const safeStatusCode =
      statusCode >= 400 && statusCode < HTTP_STATUS_UPPER_BOUND ? statusCode : 500;
    return res.status(safeStatusCode).json({
      success: false,
      message: getYoutubeErrorMessage(error),
    });
  }
};

module.exports = {
  uploadVideo,
  normalizeUploadMetadata,
  buildYoutubeRequestBody,
  youtubeMetadataSchema,
  videoFileSchema,
};
