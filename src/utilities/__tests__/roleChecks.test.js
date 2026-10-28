const { isEducator, isPM } = require('../roleChecks');

describe('roleChecks', () => {
  describe('isEducator', () => {
    it('returns true when role is Educator', () => {
      expect(isEducator({ role: 'Educator' })).toBe(true);
    });

    it('returns true when permissions include createResourceRequests', () => {
      expect(isEducator({ role: 'Volunteer', permissions: ['createResourceRequests'] })).toBe(true);
    });

    it('returns false when role is not Educator and permission is absent', () => {
      expect(isEducator({ role: 'Volunteer', permissions: ['manageResourceRequests'] })).toBe(
        false,
      );
    });

    it('returns false when permissions array is empty', () => {
      expect(isEducator({ role: 'Volunteer', permissions: [] })).toBe(false);
    });

    it('returns falsy when permissions is undefined', () => {
      expect(isEducator({ role: 'Volunteer' })).toBeFalsy();
    });

    it('returns falsy when user is undefined', () => {
      expect(isEducator(undefined)).toBeFalsy();
    });

    it('returns falsy when user is null', () => {
      expect(isEducator(null)).toBeFalsy();
    });

    it('returns falsy when user is an empty object', () => {
      expect(isEducator({})).toBeFalsy();
    });
  });

  describe('isPM', () => {
    it('returns true when role is Program Manager', () => {
      expect(isPM({ role: 'Program Manager' })).toBe(true);
    });

    it('returns true when role is Owner', () => {
      expect(isPM({ role: 'Owner' })).toBe(true);
    });

    it('returns true when role is Administrator', () => {
      expect(isPM({ role: 'Administrator' })).toBe(true);
    });

    it('returns true when permissions include manageResourceRequests', () => {
      expect(isPM({ role: 'Volunteer', permissions: ['manageResourceRequests'] })).toBe(true);
    });

    it('returns false when role is not privileged and permission is absent', () => {
      expect(isPM({ role: 'Volunteer', permissions: ['createResourceRequests'] })).toBe(false);
    });

    it('returns false when permissions array is empty', () => {
      expect(isPM({ role: 'Volunteer', permissions: [] })).toBe(false);
    });

    it('returns falsy when permissions is undefined', () => {
      expect(isPM({ role: 'Volunteer' })).toBeFalsy();
    });

    it('returns falsy when user is undefined', () => {
      expect(isPM(undefined)).toBeFalsy();
    });

    it('returns falsy when user is null', () => {
      expect(isPM(null)).toBeFalsy();
    });

    it('returns falsy when user is an empty object', () => {
      expect(isPM({})).toBeFalsy();
    });
  });
});
