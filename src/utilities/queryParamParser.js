/**
 * Multi-Select Query Parameter Parser Utility
 *
 * Generic utility for extracting, parsing, and validating multi-select query parameters.
 * Handles various input formats (single value, comma-separated, array) and optionally
 * validates MongoDB ObjectIds.
 */

const mongoose = require('mongoose');

/**
 * Extract, parse, and validate a multi-select query parameter into an array of strings.
 *
 * @param {Object} req - Express request object
 * @param {string} paramName - Name of query parameter (e.g., 'projectId' or 'materialType')
 * @param {boolean} requireObjectId - Whether values must be valid MongoDB ObjectIds (default: true)
 * @returns {string[]} Array of parameter values (ObjectId strings or plain strings)
 * @throws {Object} Structured error object with type 'OBJECTID_VALIDATION_ERROR' if validation fails
 */
function parseMultiSelectQueryParam(req, paramName, requireObjectId = true) {
  // Extract raw parameter value
  const rawValue = req.query[paramName];

  // Case 1: Parameter doesn't exist (undefined)
  if (rawValue === undefined) {
    return [];
  }

  // Case 2 & 3: Normalize to array
  let normalizedArray = [];

  if (typeof rawValue === 'string') {
    // Handle empty string - treat as "not provided"
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      return [];
    }

    // Check if it contains commas (comma-separated list)
    if (trimmed.includes(',')) {
      // Split by comma and trim each element
      normalizedArray = trimmed.split(',').map((item) => item.trim());
    } else {
      // Single value - create array with one element
      normalizedArray = [trimmed];
    }
  } else if (Array.isArray(rawValue)) {
    // Already an array - trim whitespace from each element
    normalizedArray = rawValue.map((item) =>
      typeof item === 'string' ? item.trim() : String(item).trim(),
    );
  } else {
    // Other types (number, etc.) - convert to string and create array
    normalizedArray = [String(rawValue).trim()];
  }

  // Filter out empty strings after trimming (remove any empty or whitespace-only values)
  normalizedArray = normalizedArray.filter((item) => item !== '');

  // If after filtering we have no values, return empty array
  if (normalizedArray.length === 0) {
    return [];
  }

  // If ObjectId validation is required
  if (requireObjectId) {
    const invalidValues = [];

    // Check each value for valid ObjectId
    normalizedArray.forEach((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        invalidValues.push(value);
      }
    });

    // If any invalid values found, throw structured error
    if (invalidValues.length > 0) {
      const error = {
        type: 'OBJECTID_VALIDATION_ERROR',
        message: `Invalid ${paramName} format. The following values are not valid ObjectIds: ${invalidValues.join(', ')}`,
        invalidValues,
        paramName,
      };
      throw error;
    }
  }

  // Return normalized array
  return normalizedArray;
}

module.exports = {
  parseMultiSelectQueryParam,
};
