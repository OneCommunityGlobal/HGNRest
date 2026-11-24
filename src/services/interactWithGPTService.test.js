jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const { generateDraft } = require('./interactWithGPTService');

describe('interactWithGPTService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' };
    delete process.env.GEMINI_MODEL;
    fetch.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('calls Gemini generateContent and returns generated text', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: ' A useful draft. ' }] } }],
      }),
    });

    await expect(
      generateDraft({ prompt: 'Write a note', firstName: 'Sam', userid: 'user-1' }),
    ).resolves.toBe('A useful draft.');

    expect(fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-gemini-key' }),
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].text).toContain(
      'Write a note',
    );
  });

  it('uses the optional configured model name', async () => {
    process.env.GEMINI_MODEL = 'gemini-test-model';
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Draft' }] } }] }),
    });

    await generateDraft({ prompt: 'Write a note' });

    expect(fetch.mock.calls[0][0]).toContain('/gemini-test-model:generateContent');
  });

  it('returns a clear 503 error when the Gemini API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(generateDraft({ prompt: 'Write a note' })).rejects.toMatchObject({
      statusCode: 503,
      message: 'Gemini service is not configured. Set GEMINI_API_KEY.',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps Gemini rate limits to 503', async () => {
    fetch.mockResolvedValue({ ok: false, status: 429 });

    await expect(generateDraft({ prompt: 'Write a note' })).rejects.toMatchObject({
      statusCode: 503,
      message: 'Gemini service failed to generate a draft.',
    });
  });

  it('maps other Gemini HTTP errors to 502', async () => {
    fetch.mockResolvedValue({ ok: false, status: 400 });

    await expect(generateDraft({ prompt: 'Write a note' })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('maps network failures to 502 without throwing an unhandled error', async () => {
    fetch.mockRejectedValue(new Error('network failure'));

    await expect(generateDraft({ prompt: 'Write a note' })).rejects.toMatchObject({
      statusCode: 502,
      message: 'Gemini service is unavailable.',
    });
  });

  it('maps malformed or empty Gemini responses to 502', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });

    await expect(generateDraft({ prompt: 'Write a note' })).rejects.toMatchObject({
      statusCode: 502,
      message: 'Gemini service returned no draft text.',
    });
  });
});
