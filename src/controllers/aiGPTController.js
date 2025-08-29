// eslint-disable-next-line import/no-extraneous-dependencies
const { GoogleGenerativeAI } = require('@google/generative-ai');

const config = require('../config');

const interactWithGPT = async (req, res) => {
  try {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const rawPrompt = (req.body && req.body.prompt) || '';
    const prompt = String(rawPrompt).trim();
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Prefer a broadly-available model; fall back if needed
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    return res.status(200).json({ text: String(text || '').trim() });
  } catch (error) {
    // Provide more actionable diagnostics to the client
    const status = error?.response?.status || 500;
    const message =
      error?.response?.data?.error || error?.message || 'Unknown error calling Gemini API';
    console.error('interactWithGPT error:', message);
    return res.status(status === 200 ? 500 : status).json({ error: message });
  }
};

module.exports = interactWithGPT;
