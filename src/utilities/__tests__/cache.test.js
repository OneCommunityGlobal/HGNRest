const cache = require('../cache');

describe('cache utility', () => {
  beforeEach(() => {
    // Clear cache before each test
    const keys = cache.get('__test_keys__') || [];
    keys.forEach((key) => {
      try {
        cache.get(key);
      } catch (e) {
        // Ignore errors
      }
    });
  });

  it('should get a value from cache', () => {
    const key = 'test-key';
    const value = 'test-value';
    cache.set(key, value);
    expect(cache.get(key)).toBe(value);
  });

  it('should return undefined for non-existent key', () => {
    expect(cache.get('non-existent-key')).toBeUndefined();
  });

  it('should set and get multiple values', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBe('value2');
  });

  it('should overwrite existing values', () => {
    const key = 'test-key';
    cache.set(key, 'value1');
    cache.set(key, 'value2');
    expect(cache.get(key)).toBe('value2');
  });
});
