/**
 * Test HuggingFace API key and connectivity.
 * Run from HGNRest: node test-huggingface.js
 *
 * Tests in order:
 * 1. Router v1 chat completions (recommended) with your model
 * 2. Fallback: legacy /models/{model} endpoint
 */
require('dotenv').config();
const axios = require('axios');

const { HUGGINGFACE_API_KEY } = process.env;
const HUGGINGFACE_INFERENCE_URL =
  process.env.HUGGINGFACE_API_URL || 'https://router.huggingface.co';
const HUGGINGFACE_TEXT_MODEL = process.env.HUGGINGFACE_TEXT_MODEL || 'Qwen/Qwen2.5-1.5B-Instruct';

const headers = {
  Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
  'Content-Type': 'application/json',
};

async function testV1ChatCompletions() {
  const url = `${HUGGINGFACE_INFERENCE_URL.replace(/\/$/, '')}/v1/chat/completions`;
  const body = {
    model: HUGGINGFACE_TEXT_MODEL,
    messages: [{ role: 'user', content: 'Say "Hello" in one word.' }],
    max_tokens: 10,
    temperature: 0.1,
  };
  const response = await axios.post(url, body, { headers, timeout: 30000 });
  const content = response.data?.choices?.[0]?.message?.content;
  if (content != null) return { ok: true, text: content.trim() };
  throw new Error('Unexpected response shape');
}

async function testLegacyModelsEndpoint() {
  const url = `${HUGGINGFACE_INFERENCE_URL}/models/${HUGGINGFACE_TEXT_MODEL}`;
  const body = {
    inputs: 'Say "Hello" in one word.',
    parameters: { max_new_tokens: 10, temperature: 0.1, return_full_text: false },
  };
  const response = await axios.post(url, body, { headers, timeout: 30000 });
  const { data } = response;
  const text =
    typeof data === 'string'
      ? data
      : Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : data?.generated_text;
  if (text != null) return { ok: true, text };
  throw new Error('Unexpected response shape');
}

async function testHuggingFace() {
  console.log('🔑 HuggingFace API connection test\n');
  console.log('  HUGGINGFACE_API_URL:', HUGGINGFACE_INFERENCE_URL);
  console.log('  HUGGINGFACE_TEXT_MODEL:', HUGGINGFACE_TEXT_MODEL);
  console.log(
    '  API key set:',
    HUGGINGFACE_API_KEY ? `${HUGGINGFACE_API_KEY.slice(0, 10)}...` : 'NO',
  );

  if (!HUGGINGFACE_API_KEY) {
    console.log('\n❌ FAIL: HUGGINGFACE_API_KEY is missing in .env');
    process.exit(1);
  }

  // 1. Try v1 chat completions (router recommendation)
  try {
    const result = await testV1ChatCompletions();
    console.log('\n✅ SUCCESS: HuggingFace API is connected (v1/chat/completions).');
    console.log('   Response:', result.text);
    process.exit(0);
  } catch (err) {
    const status = err.response?.status;
    const resData = err.response?.data;
    if (status === 401) {
      console.log('\n❌ FAIL: Invalid API key (401). Check HUGGINGFACE_API_KEY in .env');
      if (resData) console.log('   Body:', JSON.stringify(resData).slice(0, 200));
      process.exit(1);
    }
    if (status === 403) {
      console.log('\n❌ FAIL: Forbidden (403). Token may lack Inference permissions.');
      process.exit(1);
    }
    console.log('\n  v1/chat/completions:', status || err.code || err.message);
  }

  // 2. Fallback: legacy /models/{model}
  try {
    const result = await testLegacyModelsEndpoint();
    console.log('\n✅ SUCCESS: HuggingFace API is connected (legacy /models endpoint).');
    console.log('   Response:', result.text);
    process.exit(0);
  } catch (err) {
    const status = err.response?.status;
    const resData = err.response?.data;
    console.log('\n❌ FAIL: HuggingFace request failed.');
    console.log('   Status:', status || err.code || 'N/A');
    if (status === 401)
      console.log('   → Invalid or expired API key. Check HUGGINGFACE_API_KEY in .env');
    if (status === 403)
      console.log('   → Access forbidden. Model may require gated access or paid tier.');
    if (status === 404)
      console.log(
        '   → Model not on router. Try a model from https://huggingface.co/models?inference_provider=all&other=conversational',
      );
    if (status === 503) console.log('   → Model is loading. Retry in a minute.');
    if (resData)
      console.log(
        '   Body:',
        typeof resData === 'object' ? JSON.stringify(resData).slice(0, 300) : resData,
      );
    console.log('   Error:', err.message);
    process.exit(1);
  }
}

testHuggingFace();
