jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const { generateDraft } = require('./interactWithGPTService');

describe('interactWithGPTService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
    fetch.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('calls the configured LLM and returns its draft text', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: ' A useful draft. ' } }] }),
    });

    await expect(
      generateDraft({ prompt: 'Write a note', firstName: 'Sam', userid: 'user-1' }),
    ).resolves.toBe('A useful draft.');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('reports missing provider configuration', async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(generateDraft({ prompt: 'Write a note' })).rejects.toMatchObject({
      statusCode: 503,
      message: 'LLM service is not configured.',
    });
  });

  it('maps upstream failures to 502', async () => {
    fetch.mockResolvedValue({ ok: false });

    await expect(generateDraft({ prompt: 'Write a note' })).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});
