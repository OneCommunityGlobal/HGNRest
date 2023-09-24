// Import the 'openai' package
const OpenAI = require('openai');
const config = require('../config'); // Import config file

// Initialize the OpenAI client with the ChatGPT API key from config.js
const openai = new OpenAI({
  apiKey: config.CHATGPT_API_KEY, // Use the key from your config file
  apiUrl: config.CHATGPT_API_URL,
});

// Define a function to generate a summary using GPT-3
const generateSummary = async (req, res) => {
  try {
    // Access the current week's time entries data sent from the frontend
    const { currentWeekEntries } = req.body;

    // Create a prompt for GPT-3 using the provided notes data
    const prompt = `Summarize the following notes of my week's work: ${currentWeekEntries}, Make sure it is professionally written in 3rd person format.
    Write it as only one paragraph. Keep it less than 500 words. Start the paragraph with 'This week'.
    Make sure the paragraph contains no links or URLs and write it in a tone that is matter-of-fact and without embellishment.
    Do not add flowery language, keep it simple and factual. Do not add a final summary sentence.`;

    // Use GPT-3 to generate a summary
    const response = await openai.completions.create({
      engine: 'text-davinci-002', // can use a different engine if needed
      prompt,
      max_tokens: 150, // Adjust as needed for the desired summary length
    });

    // Extract and return the generated summary from the response
    const summary = response.choices[0].text;

    // Send the generated summary back to the frontend
    res.status(200).json({ summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate a summary.' });
  }
};

module.exports = {
  generateSummary,
};
