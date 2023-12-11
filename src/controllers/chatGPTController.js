// Import the 'openai' package
global.AbortController = require('abort-controller');
const OpenAI = require('openai');
const TimeEntry = require('../models/timeentry');

const config = require('../config'); // Import config file
const TimeEntryController = require('./timeEntryController');
// Initialize the OpenAI client with the ChatGPT API key from config.js
const openai = new OpenAI({
  apiKey: config.CHATGPT_API_KEY, // Use the key from your config file
  apiUrl: config.CHATGPT_API_URL,
});

// Remove URLs from the notes
const processNotes = notes => notes.map(note => note.replace(/https?:\/\/[^\s]+/g, ''));

const interactWithChatGPT = async (req, res) => {
    try {
        const notes = await TimeEntryController(TimeEntry).getTimeEntriesForCurrentWeek(req);
        if (!notes || (Array.isArray(notes) && notes.length === 0)) {
            return res.status(200).json({ response: 'No notes found for the current week.' });
        }
        console.log(notes, 11111);
        const processedNotes = processNotes(notes);
        const instruction = `Summarize the following notes of my week's work, Make sure it is professionally written in 3rd person format.
        Write it as only one paragraph. Keep it less than 500 words. Start the paragraph with 'This week'.
        Make sure the paragraph contains no links or URLs and write it in a tone that is matter-of-fact and without embellishment.
        Do not add flowery language, keep it simple and factual. Do not add a final summary sentence.`;
        try {
            const gptResponse = await openai.completions.create({
                model: 'gpt-3.5-turbo',
                prompt: `${instruction}\n\n${processedNotes}`,
                max_tokens: 150,
            });
            console.log(gptResponse, 90);
        return res.json({ response: gptResponse.choices[0].text.trim() });
        } catch (e) {
            console.log(openai.completions.create);
            console.log(e, 999);
            res.json({ data: e });
        }
    } catch (error) {
        return res.status(500).json({ error: "123Failed to get ChatGPT response for the current week's notes." });
    }
};

module.exports = interactWithChatGPT;
