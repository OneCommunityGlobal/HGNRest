const crypto = require('node:crypto');
const moment = require('moment-timezone');
const sanitizeHtml = require('sanitize-html');

class SplitTimeEntryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const objectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

function splitReceiptId(personId, batchId) {
  if (!objectId(personId)) throw new SplitTimeEntryError('Authentication required.', 401);
  if (typeof batchId !== 'string' || !/^[a-z\d_-]{16,100}$/i.test(batchId))
    throw new SplitTimeEntryError('A valid split-session key is required.');
  return digest(`${personId}:${batchId}`);
}

function normalizeSplitTimeEntry(body, requestorId) {
  if (!objectId(requestorId) || body.personId !== requestorId) {
    throw new SplitTimeEntryError('You can split only your own timer time.', 403);
  }
  if (typeof body.batchId !== 'string' || !/^[a-z\d_-]{16,100}$/i.test(body.batchId)) {
    throw new SplitTimeEntryError('A valid split-session key is required.');
  }
  if (
    typeof body.dateOfWork !== 'string' ||
    !moment(body.dateOfWork, 'YYYY-MM-DD', true).isValid()
  ) {
    throw new SplitTimeEntryError('A valid work date is required.');
  }
  if (body.dateOfWork > moment().tz('America/Los_Angeles').format('YYYY-MM-DD')) {
    throw new SplitTimeEntryError('The work date cannot be in the future.');
  }
  if (
    !Number.isSafeInteger(body.totalMinutes) ||
    body.totalMinutes < 1 ||
    body.totalMinutes > 60000
  ) {
    throw new SplitTimeEntryError('Session time must be between 1 minute and 1000 hours.');
  }
  if (
    !Array.isArray(body.allocations) ||
    body.allocations.length < 2 ||
    body.allocations.length > 20
  ) {
    throw new SplitTimeEntryError('Choose between 2 and 20 assigned tasks.');
  }
  const seen = new Set();
  const allocations = body.allocations.map((row) => {
    if (!row || !objectId(row.taskId))
      throw new SplitTimeEntryError('Choose an assigned task for every row.');
    const taskId = row.taskId.toLowerCase();
    if (seen.has(taskId)) throw new SplitTimeEntryError('Each task may appear only once.');
    seen.add(taskId);
    if (!Number.isSafeInteger(row.minutes) || row.minutes <= 0 || row.minutes > body.totalMinutes) {
      throw new SplitTimeEntryError('Each allocation needs a positive whole number of minutes.');
    }
    if (typeof row.notes !== 'string' || row.notes.length > 10000) {
      throw new SplitTimeEntryError('Each description must be at most 10000 characters.');
    }
    const notes = sanitizeHtml(row.notes, { allowedTags: [], allowedAttributes: {} }).trim();
    if (
      notes.split(/\s+/).filter(Boolean).length < 10 ||
      !/https:\/\/[a-z\d.-]+\.[a-z]{2,}/i.test(notes)
    ) {
      throw new SplitTimeEntryError(
        'Each task needs a description of at least 10 words and an https reference link.',
      );
    }
    return { taskId, minutes: row.minutes, notes };
  });
  if (allocations.reduce((sum, row) => sum + row.minutes, 0) !== body.totalMinutes) {
    throw new SplitTimeEntryError('Allocated time must equal the timer session total.');
  }
  const normalized = {
    personId: requestorId,
    batchId: body.batchId,
    dateOfWork: body.dateOfWork,
    totalMinutes: body.totalMinutes,
    allocations,
  };
  return {
    ...normalized,
    receiptId: splitReceiptId(requestorId, body.batchId),
    fingerprint: digest(
      JSON.stringify({
        ...normalized,
        allocations: [...allocations].sort((a, b) => a.taskId.localeCompare(b.taskId)),
      }),
    ),
  };
}

module.exports = { splitReceiptId, normalizeSplitTimeEntry, SplitTimeEntryError };
