/**
 * Transaction Helper Utility
 * Provides a reusable wrapper for MongoDB transactions with proper error handling
 */

const mongoose = require('mongoose');
const logger = require('../startup/logger');

/**
 * Execute a callback within a MongoDB transaction.
 * Handles session creation, transaction commit/abort, and cleanup automatically.
 * @param {Function} callback - Async function that receives a session parameter
 * @returns {Promise<any>} Result from the callback
 * @throws {Error} Re-throws any error from the callback after aborting transaction
 */
async function withTransaction(callback) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (abortError) {
      logger.logException(abortError, 'Error aborting transaction');
    }
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = { withTransaction };
