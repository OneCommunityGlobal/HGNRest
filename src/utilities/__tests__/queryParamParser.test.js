// Mock mongoose before requiring the module
const mockIsValid = jest.fn();
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: mockIsValid,
    },
  },
}));

const { parseMultiSelectQueryParam } = require('../queryParamParser');

describe('queryParamParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all ObjectIds are valid
    mockIsValid.mockReturnValue(true);
  });

  describe('parseMultiSelectQueryParam', () => {
    describe('Category 1: Basic Parameter Extraction', () => {
      it('should return empty array when parameter does not exist (undefined)', () => {
        const req = { query: {} };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual([]);
      });

      it('should handle null parameter by converting to string "null"', () => {
        // Note: In Express, query params are typically strings, not null
        // This test covers edge case where null might be passed
        mockIsValid.mockReturnValue(false); // "null" string is not a valid ObjectId
        const req = { query: { projectId: null } };
        expect(() => parseMultiSelectQueryParam(req, 'projectId', true)).toThrow();
        // When validation is disabled, null becomes "null" string
        const resultNoValidation = parseMultiSelectQueryParam(req, 'projectId', false);
        expect(resultNoValidation).toEqual(['null']);
      });

      it('should return empty array when parameter is empty string', () => {
        const req = { query: { projectId: '' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual([]);
      });

      it('should return empty array when parameter is whitespace-only string', () => {
        const req = { query: { projectId: '   ' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual([]);
      });
    });

    describe('Category 2: Single Value Parsing', () => {
      it('should return array with one trimmed element for single string value', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: '507f1f77bcf86cd799439011' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['507f1f77bcf86cd799439011']);
      });

      it('should trim leading and trailing whitespace from single value', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: '  507f1f77bcf86cd799439011  ' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['507f1f77bcf86cd799439011']);
      });

      it('should convert numeric value to string and return in array', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: 123 } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['123']);
      });

      it('should convert boolean value to string and return in array', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: true } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['true']);
      });
    });

    describe('Category 3: Comma-Separated Value Parsing', () => {
      it('should split comma-separated string into array', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: 'id1,id2,id3' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2', 'id3']);
      });

      it('should trim whitespace from comma-separated values', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: 'id1, id2 , id3' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2', 'id3']);
      });

      it('should filter out empty values in comma-separated string', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: 'id1,,id2' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2']);
      });

      it('should return empty array for comma-separated string with only commas', () => {
        const req = { query: { projectId: ',,' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual([]);
      });

      it('should filter out whitespace-only values in comma-separated string', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: 'id1, ,id2' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2']);
      });
    });

    describe('Category 4: Array Value Parsing', () => {
      it('should return trimmed array for array of strings', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: ['id1', 'id2'] } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2']);
      });

      it('should trim whitespace from array elements', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: [' id1 ', ' id2 '] } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2']);
      });

      it('should convert mixed types in array to strings and trim', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: ['id1', 123, true] } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', '123', 'true']);
      });

      it('should filter out empty strings from array', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: ['id1', '', 'id2'] } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2']);
      });

      it('should return empty array for empty array input', () => {
        const req = { query: { projectId: [] } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual([]);
      });
    });

    describe('Category 5: ObjectId Validation (requireObjectId = true)', () => {
      it('should return array when all ObjectIds are valid', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: '507f1f77bcf86cd799439011' } };
        const result = parseMultiSelectQueryParam(req, 'projectId', true);
        expect(result).toEqual(['507f1f77bcf86cd799439011']);
        expect(mockIsValid).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      });

      it('should throw error with one invalid ObjectId', () => {
        mockIsValid.mockImplementation((value) => value !== 'invalid');
        const req = { query: { projectId: 'invalid' } };
        expect(() => parseMultiSelectQueryParam(req, 'projectId', true)).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(error.type).toBe('OBJECTID_VALIDATION_ERROR');
          expect(error.invalidValues).toEqual(['invalid']);
          expect(error.paramName).toBe('projectId');
          expect(error.message).toContain('Invalid projectId format');
          expect(error.message).toContain('invalid');
        }
      });

      it('should throw error listing all invalid ObjectIds', () => {
        mockIsValid.mockImplementation((value) => value === 'valid1' || value === 'valid2');
        const req = { query: { projectId: 'valid1,invalid1,valid2,invalid2' } };
        expect(() => parseMultiSelectQueryParam(req, 'projectId', true)).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(error.type).toBe('OBJECTID_VALIDATION_ERROR');
          expect(error.invalidValues).toEqual(['invalid1', 'invalid2']);
          expect(error.invalidValues.length).toBe(2);
        }
      });

      it('should throw error listing only invalid values when mixed valid and invalid', () => {
        mockIsValid.mockImplementation((value) => value === 'valid1' || value === 'valid2');
        const req = { query: { projectId: 'valid1,invalid1,valid2,invalid2' } };
        expect(() => parseMultiSelectQueryParam(req, 'projectId', true)).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(error.invalidValues).not.toContain('valid1');
          expect(error.invalidValues).not.toContain('valid2');
          expect(error.invalidValues).toContain('invalid1');
          expect(error.invalidValues).toContain('invalid2');
        }
      });

      it('should return empty array when validation is required but array is empty', () => {
        const req = { query: { projectId: [] } };
        const result = parseMultiSelectQueryParam(req, 'projectId', true);
        expect(result).toEqual([]);
        expect(mockIsValid).not.toHaveBeenCalled();
      });
    });

    describe('Category 6: ObjectId Validation Disabled (requireObjectId = false)', () => {
      it('should return array as-is when validation is disabled for valid ObjectIds', () => {
        const req = { query: { projectId: '507f1f77bcf86cd799439011' } };
        const result = parseMultiSelectQueryParam(req, 'projectId', false);
        expect(result).toEqual(['507f1f77bcf86cd799439011']);
        expect(mockIsValid).not.toHaveBeenCalled();
      });

      it('should return array as-is when validation is disabled for invalid ObjectIds', () => {
        const req = { query: { projectId: 'invalid-id' } };
        const result = parseMultiSelectQueryParam(req, 'projectId', false);
        expect(result).toEqual(['invalid-id']);
        expect(mockIsValid).not.toHaveBeenCalled();
      });

      it('should return all values as strings when validation is disabled for mixed values', () => {
        const req = { query: { projectId: ['valid1', 'invalid1', 123, true] } };
        const result = parseMultiSelectQueryParam(req, 'projectId', false);
        expect(result).toEqual(['valid1', 'invalid1', '123', 'true']);
        expect(mockIsValid).not.toHaveBeenCalled();
      });
    });

    describe('Category 7: Error Handling', () => {
      it('should throw error with correct structure: type property', () => {
        mockIsValid.mockReturnValue(false);
        const req = { query: { projectId: 'invalid' } };
        expect(() => {
          parseMultiSelectQueryParam(req, 'projectId', true);
        }).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(error.type).toBe('OBJECTID_VALIDATION_ERROR');
        }
      });

      it('should throw error with correct structure: message includes parameter name and invalid values', () => {
        mockIsValid.mockReturnValue(false);
        const req = { query: { projectId: 'invalid1,invalid2' } };
        expect(() => {
          parseMultiSelectQueryParam(req, 'projectId', true);
        }).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(error.message).toContain('projectId');
          expect(error.message).toContain('invalid1');
          expect(error.message).toContain('invalid2');
        }
      });

      it('should throw error with correct structure: invalidValues array', () => {
        mockIsValid.mockReturnValue(false);
        const req = { query: { projectId: 'invalid' } };
        expect(() => {
          parseMultiSelectQueryParam(req, 'projectId', true);
        }).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(Array.isArray(error.invalidValues)).toBe(true);
          expect(error.invalidValues).toEqual(['invalid']);
        }
      });

      it('should throw error with correct structure: paramName property', () => {
        mockIsValid.mockReturnValue(false);
        const req = { query: { materialType: 'invalid' } };
        expect(() => {
          parseMultiSelectQueryParam(req, 'materialType', true);
        }).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'materialType', true);
        } catch (error) {
          expect(error.paramName).toBe('materialType');
        }
      });
    });

    describe('Category 8: Edge Cases', () => {
      it('should convert number parameter to string', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: 12345 } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['12345']);
        expect(typeof result[0]).toBe('string');
      });

      it('should convert boolean parameter to string', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: false } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['false']);
        expect(typeof result[0]).toBe('string');
      });

      it('should convert object parameter to string', () => {
        mockIsValid.mockReturnValue(false);
        const req = { query: { projectId: { key: 'value' } } };
        expect(() => parseMultiSelectQueryParam(req, 'projectId', true)).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(error.invalidValues[0]).toContain('[object Object]');
        }
      });

      it('should handle very long string values correctly', () => {
        mockIsValid.mockReturnValue(true);
        const longString = 'a'.repeat(1000);
        const req = { query: { projectId: longString } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual([longString]);
        expect(result[0].length).toBe(1000);
      });

      it('should preserve special characters in values (validation will catch if invalid)', () => {
        mockIsValid.mockReturnValue(false);
        const req = { query: { projectId: 'id@#$%^&*()' } };
        expect(() => parseMultiSelectQueryParam(req, 'projectId', true)).toThrow();
        try {
          parseMultiSelectQueryParam(req, 'projectId', true);
        } catch (error) {
          expect(error.invalidValues[0]).toBe('id@#$%^&*()');
        }
      });

      it('should handle null in array elements', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: ['id1', null, 'id2'] } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'null', 'id2']);
      });

      it('should handle undefined in array elements', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: ['id1', undefined, 'id2'] } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'undefined', 'id2']);
      });
    });

    describe('Integration: Complex Scenarios', () => {
      it('should handle comma-separated string with valid ObjectIds', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: '507f1f77bcf86cd799439011,507f191e810c19729de860ea' } };
        const result = parseMultiSelectQueryParam(req, 'projectId', true);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe('507f1f77bcf86cd799439011');
        expect(result[1]).toBe('507f191e810c19729de860ea');
      });

      it('should handle array with valid ObjectIds', () => {
        mockIsValid.mockReturnValue(true);
        const req = {
          query: {
            projectId: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea'],
          },
        };
        const result = parseMultiSelectQueryParam(req, 'projectId', true);
        expect(result).toHaveLength(2);
        expect(mockIsValid).toHaveBeenCalledTimes(2);
      });

      it('should handle mixed whitespace and valid values', () => {
        mockIsValid.mockReturnValue(true);
        const req = { query: { projectId: '  id1  ,  id2  ,  id3  ' } };
        const result = parseMultiSelectQueryParam(req, 'projectId');
        expect(result).toEqual(['id1', 'id2', 'id3']);
      });
    });
  });
});
