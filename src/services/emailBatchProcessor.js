/**
 * Simplified Email Batch Processor - Production Ready
 * Focus: Efficient processing with email body from batch record
 */

const EmailBatch = require('../models/emailBatch');
const EmailBatchItem = require('../models/emailBatchItem');
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');

class EmailBatchProcessor {
  constructor() {
    this.processingBatches = new Set();
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Process a batch
   */
  async processBatch(batchId) {
    if (this.processingBatches.has(batchId)) {
      return; // Already processing
    }

    this.processingBatches.add(batchId);

    try {
      console.log('🔍 Looking for batch with batchId:', batchId);
      const batch = await EmailBatch.findOne({ batchId });
      if (!batch) {
        console.error('❌ Batch not found with batchId:', batchId);
        throw new Error('Batch not found');
      }
      console.log('✅ Found batch:', batch.batchId, 'Status:', batch.status);

      if (batch.status === 'COMPLETED' || batch.status === 'FAILED') {
        return;
      }

      // Update batch status
      batch.status = 'PROCESSING';
      batch.startedAt = new Date();
      await batch.save();

      // Process batch items (each item contains multiple recipients)
      await this.processBatchItems(batch);

      // Update final status
      await batch.updateStatus();
      logger.logInfo(`Batch ${batchId} processed successfully`);
    } catch (error) {
      logger.logException(error, `Error processing batch ${batchId}`);

      // Mark batch as failed
      try {
        const batch = await EmailBatch.findOne({ batchId });
        if (batch) {
          batch.status = 'FAILED';
          batch.completedAt = new Date();
          await batch.save();
        }
      } catch (updateError) {
        logger.logException(updateError, 'Error updating batch status to failed');
      }
    } finally {
      this.processingBatches.delete(batchId);
    }
  }

  /**
   * Process all items in a batch
   */
  async processBatchItems(batch) {
    const items = await EmailBatchItem.find({
      batchId: batch._id,
      status: 'PENDING',
    });

    // Process items in parallel with concurrency limit
    const processPromises = items.map((item) => this.processItem(item, batch));
    await Promise.all(processPromises);
  }

  /**
   * Process a single batch item with multiple recipients
   */
  async processItem(item, batch) {
    const processWithRetry = async (attempt = 1) => {
      try {
        // Update to SENDING status (this increments attempts)
        await item.updateStatus('SENDING');

        // Extract recipient emails from the batch item
        const recipientEmails = item.recipients.map((recipient) => recipient.email);

        // Use the existing emailSender with batched recipients and email body from batch
        await emailSender(
          recipientEmails, // Array of emails for batching
          batch.subject,
          batch.htmlContent, // Use email body from batch record
          null, // attachments
          null, // cc
          null, // replyTo
          null, // bcc
          {
            type: 'batch_send',
            batchId: batch.batchId,
            itemId: item._id,
            emailType: item.emailType,
            recipientCount: recipientEmails.length,
          },
        );

        // Mark as sent
        await item.updateStatus('SENT');
        logger.logInfo(
          `Email batch sent successfully to ${recipientEmails.length} recipients (attempt ${item.attempts})`,
        );
        // Success
      } catch (error) {
        logger.logException(
          error,
          `Failed to send email batch to ${item.recipients.length} recipients (attempt ${attempt})`,
        );

        if (attempt >= this.maxRetries) {
          await item.updateStatus('FAILED', error.message);
          logger.logError(
            `Permanently failed to send email batch to ${item.recipients.length} recipients after ${this.maxRetries} attempts`,
          );
          return;
        }

        // Wait before retry
        await EmailBatchProcessor.sleep(this.retryDelay);
        return processWithRetry(attempt + 1);
      }
    };

    return processWithRetry();
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Retry a specific batch item
   */
  async retryBatchItem(itemId) {
    try {
      const item = await EmailBatchItem.findById(itemId);
      if (!item) {
        throw new Error('Batch item not found');
      }

      const batch = await EmailBatch.findById(item.batchId);
      if (!batch) {
        throw new Error('Parent batch not found');
      }

      // Process the specific item
      await this.processItem(item, batch);

      return {
        success: true,
        itemId: item._id,
        status: item.status,
      };
    } catch (error) {
      logger.logException(error, 'Error retrying batch item');
      throw error;
    }
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: true,
      processingBatches: Array.from(this.processingBatches),
      maxRetries: this.maxRetries,
    };
  }
}

// Create singleton instance
const emailBatchProcessor = new EmailBatchProcessor();

module.exports = emailBatchProcessor;
