const fetch = require('node-fetch');

const DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const HTTP_BAD_GATEWAY = 502;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;

const createServiceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateDraft = async ({ prompt, userid, firstName }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createServiceError(
      'Gemini service is not configured. Set GEMINI_API_KEY.',
      HTTP_SERVICE_UNAVAILABLE,
    );
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`;
  const userContext = [
    `Write a clear, helpful draft for ${firstName || 'the user'} (user ID: ${userid || 'unknown'}).`,
    'Return only the draft text.',
    '',
    `User request:\n${prompt}`,
  ].join('\n');
  let response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userContext }] }],
        generationConfig: { temperature: 0.7 },
      }),
    });
  } catch (error) {
    throw createServiceError('Gemini service is unavailable.', HTTP_BAD_GATEWAY);
  }

  if (!response.ok) {
    const isTemporaryFailure = response.status === HTTP_TOO_MANY_REQUESTS || response.status >= 500;
    const statusCode = isTemporaryFailure ? HTTP_SERVICE_UNAVAILABLE : HTTP_BAD_GATEWAY;
    throw createServiceError('Gemini service failed to generate a draft.', statusCode);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw createServiceError('Gemini service returned an invalid response.', HTTP_BAD_GATEWAY);
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .filter((part) => typeof part.text === 'string')
        .map((part) => part.text)
        .join('')
        .trim()
    : '';

  if (!text) {
    throw createServiceError('Gemini service returned no draft text.', HTTP_BAD_GATEWAY);
  }

  return text;
};

module.exports = { generateDraft };
