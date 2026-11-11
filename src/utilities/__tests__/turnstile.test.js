const { verifyTurnstileToken, SITEVERIFY_URL } = require('../turnstile');

describe('verifyTurnstileToken', () => {
  const originalFetch = global.fetch;
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    jest.restoreAllMocks();
  });

  it('skips without calling Cloudflare when no secret is configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(verifyTurnstileToken('tok')).resolves.toEqual({ status: 'skipped' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails a missing token without calling Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    await expect(verifyTurnstileToken(undefined)).resolves.toEqual({ status: 'failed' });
    await expect(verifyTurnstileToken('  ')).resolves.toEqual({ status: 'failed' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('passes a token Cloudflare accepts and sends secret, token and ip', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await expect(verifyTurnstileToken('good', '9.9.9.9')).resolves.toEqual({ status: 'passed' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    expect(init.body.get('secret')).toBe('secret');
    expect(init.body.get('response')).toBe('good');
    expect(init.body.get('remoteip')).toBe('9.9.9.9');
  });

  it('fails a token Cloudflare rejects', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    await expect(verifyTurnstileToken('bad')).resolves.toEqual({ status: 'failed' });
  });

  it('fails open on a network error', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch.mockRejectedValue(new Error('ECONNRESET'));
    await expect(verifyTurnstileToken('tok')).resolves.toEqual({ status: 'unavailable' });
  });

  it('fails open on a non-2xx response', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(verifyTurnstileToken('tok')).resolves.toEqual({ status: 'unavailable' });
  });

  it('fails open when the request times out after 5 s', async () => {
    jest.useFakeTimers();
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch.mockImplementation(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const pending = verifyTurnstileToken('tok');
    await jest.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ status: 'unavailable' });
    jest.useRealTimers();
  });
});
