const axios = require('axios');

const { PINECONE_API_KEY } = process.env;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'hgn-chatbot';
const { PINECONE_HOST } = process.env;
const { HUGGINGFACE_API_KEY } = process.env;

// Use the correct free-tier API and an open model. If you get 404, try HUGGINGFACE_API_URL=https://api-inference.huggingface.co
const HUGGINGFACE_INFERENCE_URL =
  process.env.HUGGINGFACE_API_URL || 'https://router.huggingface.co';
const HUGGINGFACE_TEXT_MODEL = process.env.HUGGINGFACE_TEXT_MODEL || 'Qwen/Qwen2.5-1.5B-Instruct';

const TOP_K = parseInt(process.env.CHATBOT_TOP_K || '3', 10);

// --- 1.5. MODAL EMBEDDING SERVICE ---
async function getEmbedding(text) {
  const input = text.slice(0, 8000);

  if (!process.env.EMBEDDING_SERVICE_URL) {
    throw new Error('EMBEDDING_SERVICE_URL is missing in .env');
  }

  const url = process.env.EMBEDDING_SERVICE_URL.replace(/\/$/, '');

  const timeoutMs = parseInt(process.env.EMBEDDING_SERVICE_TIMEOUT_MS || '60000', 10);
  try {
    const response = await axios.post(
      url,
      { inputs: input }, // Modal modal_service.py EmbedRequest.inputs
      { timeout: timeoutMs },
    );

    // Modal modal_service.py returns flat array; some deployments return { embedding: [...] }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data && Array.isArray(response.data.embedding)) {
      return response.data.embedding;
    }
    throw new Error(
      'Embedding service returned unexpected format (expected array or { embedding }).',
    );
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data ?? err.message;
    throw new Error(`Modal Service Error [${status}]: ${JSON.stringify(message)}`);
  }
}

function cleanContextText(text) {
  if (!text || typeof text !== 'string') return '';

  return (
    text
      .split('\n')
      .map((line) => line.trim())
      // Remove lines that look like Base64 (long strings with no spaces)
      .filter((line) => line.length > 0 && !(line.length > 100 && !line.includes(' ')))
      .join(' ')
      .slice(0, 2000)
  );
}

// --- 2. PINECONE SEARCH ---
async function queryPinecone(vector, options = {}) {
  if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not configured.');
  const indexName = options.indexName || PINECONE_INDEX_NAME;
  const host =
    PINECONE_HOST ||
    `${indexName}.svc.${process.env.PINECONE_ENVIRONMENT || 'gcp-starter'}.pinecone.io`;
  const topK = options.topK ?? TOP_K;
  const namespace = options.namespace ?? process.env.PINECONE_NAMESPACE ?? '';

  const url = `https://${host}/query`;
  const body = { vector, topK, includeMetadata: true, includeValues: false };
  if (namespace) body.namespace = namespace;

  const headers = {
    'Api-Key': PINECONE_API_KEY,
    'Content-Type': 'application/json',
    'X-Pinecone-Api-Version': process.env.PINECONE_API_VERSION || '2024-07',
  };

  const response = await axios.post(url, body, { headers, timeout: 10000 });

  return (response.data?.matches || []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata || {},
    source_document: m.metadata?.source_document || m.id,
    text: m.metadata?.text || m.metadata?.content || JSON.stringify(m.metadata || {}),
  }));
}

function buildReplyFromMatches(matches) {
  if (!matches || matches.length === 0) {
    return "I couldn't find relevant information for that question. Try rephrasing or ask something else.";
  }

  // Better formatting for the raw Pinecone results
  const contextParts = matches.map((m, i) => {
    const cleanText = cleanContextText(m.text);
    const source = m.source_document || m.id;
    return `**Source ${i + 1}** (${source}):\n${cleanText}`;
  });

  return `I found the following information for you:\n\n${contextParts.join('\n\n')}\n\n*Note: This is raw information from our knowledge base. For a more conversational response, the AI generation service is currently being updated.*`;
}

async function rewriteFollowUpQuestion(question, history = []) {
  // No AI rewrite, just return the raw question
  return question;
}

// --- 3. HUGGING FACE GENERATION (router v1/chat/completions) ---
async function generateWithHuggingFace(messages, options = {}) {
  if (!HUGGINGFACE_API_KEY) throw new Error('HUGGINGFACE_API_KEY is not configured.');

  const model = options.model || HUGGINGFACE_TEXT_MODEL;
  const baseUrl = (HUGGINGFACE_INFERENCE_URL || '').replace(/\/$/, '');
  const url = `${baseUrl}/v1/chat/completions`;
  const body = {
    model,
    messages,
    max_tokens: options.maxNewTokens ?? 512,
    temperature: options.temperature ?? 0.1,
  };

  const response = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${HUGGINGFACE_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  throw new Error('Unexpected response from HuggingFace inference');
}

function looksLikeNoInfoReply(reply) {
  if (!reply || typeof reply !== 'string') return true;
  const r = reply.trim().toLowerCase();
  return (
    r.includes("couldn't find relevant") ||
    r.includes('could not find relevant') ||
    r.includes("don't have relevant") ||
    r.includes('do not have relevant') ||
    (r.includes('rephras') && r.length < 150)
  );
}

async function chatWithHuggingFace(userMessage, contextText, history = []) {
  const systemPrompt =
    'You are an administrative assistant chatbot answering procedural queries. ' +
    'Use the following pieces of retrieved context to answer the question. ' +
    "If you don't know the answer, just say that you don't know. " +
    "At the end of your response, you MUST cite the 'source_document' and " +
    'provide any relevant URLs or Video Links found in the text.';

  const contextBlock = contextText
    ? `Context:\n${contextText}\n\nUser question: ${userMessage}`
    : userMessage;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: contextBlock },
  ];

  return generateWithHuggingFace(messages, {
    model: HUGGINGFACE_TEXT_MODEL,
    maxNewTokens: 512,
    temperature: 0.1,
  });
}

// --- 4. MAIN ORCHESTRATOR ---
async function getChatbotReply(message, history = []) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { reply: 'Please enter a question.', sources: [] };
  }

  const trimmedMessage = message.trim();

  if (!PINECONE_API_KEY) {
    return { reply: 'Chatbot is not fully configured. Set PINECONE_API_KEY.', sources: [] };
  }

  try {
    const rewritten = await rewriteFollowUpQuestion(trimmedMessage, history);
    const embedding = await getEmbedding(rewritten);
    const matches = await queryPinecone(embedding, { topK: TOP_K });
    const contextText = matches.map((m) => cleanContextText(m.text)).join('\n\n');

    const useLLM = !!HUGGINGFACE_API_KEY && matches.length > 0;
    let reply;

    if (useLLM) {
      try {
        reply = await chatWithHuggingFace(rewritten, contextText, history);
        // If the LLM said "no relevant info" but we have matches, show the context instead
        if (looksLikeNoInfoReply(reply) && matches.length > 0) {
          reply = buildReplyFromMatches(matches);
        }
      } catch (err) {
        console.warn(`HuggingFace generation failed: ${err.message}. Falling back to raw results.`);
        reply = buildReplyFromMatches(matches);
      }
    } else {
      reply = buildReplyFromMatches(matches);
    }

    return {
      reply,
      sources: matches.slice(0, 3).map((m) => ({
        id: m.id,
        text: m.text.slice(0, 200),
        score: m.score,
        source_document: m.source_document,
        metadata: m.metadata,
      })),
    };
  } catch (err) {
    console.error('Chatbot error:', err.message);
    return { reply: `Sorry, something went wrong: ${err.message}`, sources: [] };
  }
}

module.exports = {
  getChatbotReply,
  getEmbedding,
  queryPinecone,
};

// const axios = require('axios');

// // Configuration from Environment
// const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
// const PINECONE_HOST = process.env.PINECONE_HOST;
// const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
// const HF_MODEL = process.env.HUGGINGFACE_TEXT_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
// const MODAL_URL = process.env.EMBEDDING_SERVICE_URL;
// const TOP_K = parseInt(process.env.CHATBOT_TOP_K || '5', 10);

// /**
//  * 1. GET EMBEDDING (Modal BGE-M3)
//  * Fetches 1024-dimension vector from your Modal deployment.
//  */
// async function getEmbedding(text) {
//   try {
//     const response = await axios.post(MODAL_URL,
//       { inputs: text.slice(0, 8000) },
//       { timeout: 15000 }
//     );
//     // Return flat array: [0.1, -0.2, ...]
//     return Array.isArray(response.data) ? response.data : response.data.embedding;
//   } catch (err) {
//     throw new Error(`Embedding Service (Modal) Failed: ${err.message}`);
//   }
// }

// /**
//  * 2. PINECONE QUERY
//  */
// async function queryPinecone(vector) {
//   const url = `https://${PINECONE_HOST}/query`;
//   const response = await axios.post(url,
//     { vector, topK: TOP_K, includeMetadata: true },
//     { headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' } }
//   );

//   return (response.data?.matches || []).map(m => ({
//     text: m.metadata?.text || m.metadata?.content || "",
//     source: m.metadata?.source_document || "Unknown Source",
//     score: m.score
//   }));
// }

// /**
//  * 3. HUGGING FACE GENERATION (Qwen)
//  */
// async function generateAnswer(question, context) {
//   const prompt = `<|im_start|>system\nYou are a helpful administrative assistant. Use the provided context to answer the user question accurately. If the context does not contain the answer, politely say you don't know.<|im_end|>\n<|im_start|>user\nContext:\n${context}\n\nQuestion: ${question}<|im_end|>\n<|im_start|>assistant\n`;

//   try {
//     const response = await axios.post(
//       `https://router.huggingface.co/models/${HF_MODEL}`,
//       {
//         inputs: prompt,
//         parameters: { max_new_tokens: 500, temperature: 0.1, return_full_text: false }
//       },
//       { headers: { Authorization: `Bearer ${HF_API_KEY}` }, timeout: 30000 }
//     );

//     const data = response.data;
//     const result = Array.isArray(data) ? data[0].generated_text : data.generated_text;
//     return result || "I'm sorry, I couldn't generate a response.";
//   } catch (err) {
//     throw new Error(`LLM Generation (Qwen) Failed: ${err.message}`);
//   }
// }

// /**
//  * 4. CLEAN DATA (Prevents Base64 garbage from entering LLM)
//  */
// function isCleanText(text) {
//   // Reject strings that look like Base64 (long, no spaces, special chars)
//   if (text.length > 60 && !text.includes(' ')) return false;
//   if (text.includes('/xYtWh')) return false; // Specific filter for your current garbage data
//   return true;
// }

// /**
//  * 5. MAIN ORCHESTRATOR
//  */
// async function getChatbotReply(message) {
//   if (!message?.trim()) return { reply: "Please provide a question." };

//   try {
//     // A. Vectorize
//     const vector = await getEmbedding(message.trim());

//     // B. Search Pinecone
//     const matches = await queryPinecone(vector);

//     // C. Filter for Quality
//     // We only keep matches that aren't "garbage" and have a decent score
//     const validMatches = matches.filter(m => m.score > 0.6 && isCleanText(m.text));

//     if (validMatches.length === 0) {
//       return {
//         reply: "I couldn't find any relevant information in our documents to answer that. Could you please rephrase?",
//         sources: []
//       };
//     }

//     // D. Build Context
//     const contextText = validMatches
//       .map(m => `[Source: ${m.source}]: ${m.text}`)
//       .join('\n\n')
//       .slice(0, 3000); // Token limit safety

//     // E. Generate with Qwen
//     const reply = await generateAnswer(message.trim(), contextText);

//     return {
//       reply,
//       sources: validMatches.slice(0, 3).map(m => ({
//         source: m.source,
//         score: m.score.toFixed(2)
//       }))
//     };

//   } catch (err) {
//     console.error("Chatbot Error:", err.message);
//     return {
//       reply: `I encountered an error while processing your request: ${err.message}`,
//       sources: []
//     };
//   }
// }

// module.exports = { getChatbotReply };
