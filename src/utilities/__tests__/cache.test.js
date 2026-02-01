const cache = require('../cache');

describe('cache utility', () => {
  beforeEach(() => {
    // Clear cache before each test if necessary
    // In this simple implementation, there's no direct clear method,
    // but new instances would be isolated if created per test.
    // For a shared cache, consider mocking or a dedicated clear.
  });

  it('should set and get a value from the cache', () => {
    const key = 'testKey';
    const value = 'testValue';
    cache.set(key, value);
    expect(cache.get(key)).toBe(value);
  });

  it('should return undefined for a non-existent key', () => {
    const key = 'nonExistentKey';
    expect(cache.get(key)).toBeUndefined();
  });

  it('should overwrite an existing key with a new value', () => {
    const key = 'overwriteKey';
    cache.set(key, 'initialValue');
    cache.set(key, 'newValue');
    expect(cache.get(key)).toBe('newValue');
  });
});
