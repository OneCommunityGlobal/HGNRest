const { generateDraft } = require('../services/interactWithGPTService');

const interactWithGPT = async (req, res) => {
  const body = req.body || {};
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required and must be a non-empty string.' });
  }

  try {
    const text = await generateDraft({
      prompt,
      userid: body.userid || null,
      firstName: typeof body.firstName === 'string' ? body.firstName.trim() : '',
    });
    return res.status(200).json({ text });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    return res.status(statusCode).json({ error: error.message || 'Draft generation failed.' });
  }
};

module.exports = { interactWithGPT };
