const fetch = require('node-fetch');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;

const createServiceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateDraft = async ({ prompt, userid, firstName }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createServiceError('LLM service is not configured.', HTTP_SERVICE_UNAVAILABLE);
  }

  const endpoint = process.env.OPENAI_BASE_URL || DEFAULT_ENDPOINT;
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  let response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Write a clear, helpful draft based on the user request. Return only the draft text.',
          },
          {
            role: 'user',
            content: `Write a draft for ${firstName || 'the user'} (user ID: ${userid || 'unknown'}):\n\n${prompt}`,
          },
        ],
        temperature: 0.7,
      }),
    });
  } catch (error) {
    throw createServiceError('LLM service is unavailable.', HTTP_BAD_GATEWAY);
  }

  if (!response.ok) {
    throw createServiceError('LLM service failed to generate a draft.', HTTP_BAD_GATEWAY);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw createServiceError('LLM service returned an invalid response.', HTTP_BAD_GATEWAY);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw createServiceError('LLM service returned no draft text.', HTTP_BAD_GATEWAY);
  }

  return text.trim();
};

module.exports = { generateDraft };
