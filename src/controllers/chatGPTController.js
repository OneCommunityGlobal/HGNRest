// Import the 'openai' package
global.AbortController = require("abort-controller");
const OpenAI = require("openai");
const TimeEntry = require("../models/timeentry");
const AIPrompt = require("../models/weeklySummaryAIPrompt");

const config = require("../config"); // Import config file
const TimeEntryController = require("./timeEntryController");
// Initialize the OpenAI client with the ChatGPT API key from config.js
const openai = new OpenAI({
  apiKey: config.CHATGPT_API_KEY, // Use the key from your config file
});
/**
 * takes in a request which contains the user's name and id
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @returns {Object} json containing a string from ChatGPT
 */
const interactWithChatGPT = async (req, res) => {
  try {
    // get the user's notes and the latest prompt
    let notes = await TimeEntryController(
      TimeEntry,
    ).getTimeEntriesForCurrentWeek(req.body.requestor);
    const prompt = await AIPrompt.findById({ _id: "ai-prompt" });

    if (!notes || (Array.isArray(notes) && notes.length === 0)) {
      return res
        .status(200)
        .json({ response: "No notes found for the current week." });
    }

    notes = notes.map((note) => note.replace(/https?:\/\/[^\s]+/g, ""));
    notes = notes.join(" ");

    const instruction = prompt.aIPromptText.replace(
      "This week",
      `This week ${req.body.firstName}`,
    );

    try {
      const gptResponse = await openai.chat.completions.create({
        messages: [{ role: "system", content: `${instruction}\n\n${notes}` }],
        model: "gpt-3.5-turbo",
      });

      res.status(200);
      return res.json({ GPTSummary: gptResponse.choices[0].message.content });
    } catch (e) {
      res.status(500).json({ data: e.message });
    }
  } catch (error) {
    return res.status(500).json({
      error: "123Failed to get ChatGPT response for the current week's notes.",
    });
  }

  return null;
};

module.exports = interactWithChatGPT;
