// eslint-disable-next-line import/no-extraneous-dependencies
const { GoogleGenerativeAI } = require('@google/generative-ai');

const config = require('../config');

const interactWithGPT = async (req, res) => {
  try {
    // Access your API key as an environment variable
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    // For text-only input, use the gemini-pro model
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = req.body.prompt || 'Write a story about a magic backpack.';

    // Generate content using the model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    res.json({ text });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = interactWithGPT;
