const { clearCache, getCache, setCache } = require('./popularityCache');

describe('popularityCache', () => {
  const now = new Date('2026-11-16T12:00:00Z').getTime();

  beforeEach(() => {
    clearCache();
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    clearCache();
    jest.useRealTimers();
  });

  it('returns null for a key that was never cached', () => {
    expect(getCache('missing')).toBeNull();
  });

  it('keeps a default entry through the five-minute boundary and removes it after', () => {
    const value = [{ month: '2026-11', hitsCount: 7 }];
    setCache('timeline', value);

    jest.setSystemTime(now + 5 * 60 * 1000);
    expect(getCache('timeline')).toEqual(value);

    jest.setSystemTime(now + 5 * 60 * 1000 + 1);
    expect(getCache('timeline')).toBeNull();

    jest.setSystemTime(now);
    expect(getCache('timeline')).toBeNull();
  });

  it('uses the custom TTL independently for each key', () => {
    setCache('short', ['short'], 100);
    setCache('long', ['long'], 200);

    jest.setSystemTime(now + 101);

    expect(getCache('short')).toBeNull();
    expect(getCache('long')).toEqual(['long']);
  });

  it('replaces the value and expiration when a key is written again', () => {
    setCache('timeline', ['original'], 100);
    jest.setSystemTime(now + 50);
    setCache('timeline', [], 100);

    jest.setSystemTime(now + 101);
    expect(getCache('timeline')).toEqual([]);

    jest.setSystemTime(now + 151);
    expect(getCache('timeline')).toBeNull();
  });

  it('clears a single key while keeping other entries', () => {
    setCache('volunteer', [1]);
    setCache('administrator', [2]);

    clearCache('volunteer');

    expect(getCache('volunteer')).toBeNull();
    expect(getCache('administrator')).toEqual([2]);
  });

  it('clears all entries when no key is supplied', () => {
    setCache('volunteer', [1]);
    setCache('administrator', [2]);

    clearCache();

    expect(getCache('volunteer')).toBeNull();
    expect(getCache('administrator')).toBeNull();
  });
});
