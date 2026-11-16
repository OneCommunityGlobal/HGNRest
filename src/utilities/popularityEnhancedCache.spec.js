const Cache = require('./popularityEnhancedCache');

describe('EnhancedPopularityCache', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const tenMinutes = 10 * 60 * 1000;

  beforeEach(() => {
    Cache.clear();
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    Cache.clear();
    jest.useRealTimers();
  });

  it('returns null for missing keys and roles', () => {
    expect(Cache.get('missing')).toBeNull();
    expect(Cache.getRoleData('Volunteer')).toBeNull();
  });

  it('keeps a default entry through ten minutes and removes it once expired', () => {
    Cache.set('timeline', [1]);

    jest.setSystemTime(now + tenMinutes);
    expect(Cache.get('timeline')).toEqual([1]);

    jest.setSystemTime(now + tenMinutes + 1);
    expect(Cache.get('timeline')).toBeNull();
    expect(Cache.getStats()).toEqual({ size: 0, keys: [] });
  });

  it('uses a custom lifetime and replaces the value and expiration on write', () => {
    Cache.set('timeline', [1], 100);
    jest.setSystemTime(now + 50);
    Cache.set('timeline', [2], 200);

    jest.setSystemTime(now + 101);
    expect(Cache.get('timeline')).toEqual([2]);

    jest.setSystemTime(now + 251);
    expect(Cache.get('timeline')).toBeNull();
  });

  it('uses the default lifetime for role data', () => {
    Cache.setRoleData('Volunteer', [1]);

    jest.setSystemTime(now + tenMinutes);
    expect(Cache.getRoleData('Volunteer')).toEqual([1]);

    jest.setSystemTime(now + tenMinutes + 1);
    expect(Cache.getRoleData('Volunteer')).toBeNull();
  });

  it('returns the latest monthly value for a role across a UTC year boundary', () => {
    jest.setSystemTime(new Date('2026-12-31T23:59:00Z'));
    Cache.setRoleData('Volunteer', [12]);
    Cache.setRoleData('Administrator', [99]);

    jest.setSystemTime(new Date('2027-01-01T00:01:00Z'));
    Cache.setRoleData('Volunteer', [1], 1000);

    expect(Cache.getRoleData('Volunteer')).toEqual([1]);
    expect(Cache.getRoleData('Administrator')).toEqual([99]);
    expect(Cache.getStats()).toEqual({
      size: 3,
      keys: ['role_Volunteer_2026-12', 'role_Administrator_2026-12', 'role_Volunteer_2027-01'],
    });
  });

  it('clears the selected role across months and preserves other entries', () => {
    jest.setSystemTime(new Date('2026-12-31T23:59:00Z'));
    Cache.setRoleData('Volunteer', [12]);
    jest.setSystemTime(new Date('2027-01-01T00:01:00Z'));
    Cache.setRoleData('Volunteer', [1]);
    Cache.setRoleData('Administrator', [2]);
    Cache.set('timeline', [3]);

    Cache.clearRoleCache('Volunteer');

    expect(Cache.getRoleData('Volunteer')).toBeNull();
    expect(Cache.getRoleData('Administrator')).toEqual([2]);
    expect(Cache.get('timeline')).toEqual([3]);
    expect(Cache.getStats().keys).toEqual(['role_Administrator_2027-01', 'timeline']);
  });

  it('deletes one key and clears all remaining entries', () => {
    Cache.set('timeline', [1]);
    Cache.setRoleData('Volunteer', [2]);

    Cache.delete('timeline');

    expect(Cache.get('timeline')).toBeNull();
    expect(Cache.getRoleData('Volunteer')).toEqual([2]);

    Cache.clear();

    expect(Cache.getRoleData('Volunteer')).toBeNull();
    expect(Cache.getStats()).toEqual({ size: 0, keys: [] });
  });
});
