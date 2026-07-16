const {
  deepCopyMongooseObjectWithLodash,
  filterFieldsFromObj,
  returnObjectDifference,
} = require('../objectUtils');

describe('objectUtils', () => {
  describe('deepCopyMongooseObjectWithLodash', () => {
    it('returns a deep cloned plain object from a mongoose document', () => {
      const originalPlainObject = { name: 'sample', nested: { value: 42 } };
      const mockDoc = {
        toObject: jest.fn(() => originalPlainObject),
      };

      const cloned = deepCopyMongooseObjectWithLodash(mockDoc);

      expect(cloned).toEqual(originalPlainObject);
      expect(cloned).not.toBe(originalPlainObject);
      expect(cloned.nested).not.toBe(originalPlainObject.nested);
      expect(mockDoc.toObject).toHaveBeenCalledWith({ getters: true, virtuals: false });
    });
  });

  describe('filterFieldsFromObj', () => {
    it('keeps only requested keys and drops excluded keys', () => {
      const source = {
        _id: '123',
        password: 'secret',
        firstName: 'Jane',
        lastName: 'Doe',
        hoursByCategory: 5,
      };

      const result = filterFieldsFromObj(source, ['firstName', 'lastName', 'hoursByCategory']);

      expect(result).toEqual({ firstName: 'Jane', lastName: 'Doe' });
    });
  });

  describe('returnObjectDifference', () => {
    it('returns the differing values between two filtered objects', () => {
      const original = {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
      };
      const updated = {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
      };

      const diff = returnObjectDifference(original, updated, ['firstName', 'lastName', 'email']);

      expect(diff).toEqual({
        originalObj: { lastName: 'Smith' },
        updatedObj: { lastName: 'Johnson' },
      });
    });
  });
});
