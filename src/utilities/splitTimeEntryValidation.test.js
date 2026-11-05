const moment = require('moment-timezone');
const { normalizeSplitTimeEntry, splitReceiptId } = require('./splitTimeEntryValidation');

const user = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const notes =
  'Implemented and tested the assigned task with isolated fixtures and documented the result https://example.org/pr';
const makeInput = () => ({
  personId: user,
  batchId: 'a-server-session-12345',
  dateOfWork: moment().tz('America/Los_Angeles').format('YYYY-MM-DD'),
  totalMinutes: 300,
  allocations: [
    { taskId: 'bbbbbbbbbbbbbbbbbbbbbbbb', minutes: 180, notes },
    { taskId: 'cccccccccccccccccccccccc', minutes: 120, notes },
  ],
});

test('normalizes task IDs, strips executable markup and keeps stable fingerprints across row ordering', () => {
  const input = makeInput();
  input.allocations[0].taskId = input.allocations[0].taskId.toUpperCase();
  input.allocations[0].notes = `<script>secret()</script><b>${notes}</b>`;
  const normalized = normalizeSplitTimeEntry(input, user);
  expect(normalized.allocations[0].notes).toBe(notes);
  expect(normalized.fingerprint).toBe(
    normalizeSplitTimeEntry({ ...input, allocations: [...input.allocations].reverse() }, user)
      .fingerprint,
  );
});

test.each([
  [
    'another person',
    (input) => {
      input.personId = 'dddddddddddddddddddddddd';
    },
  ],
  [
    'invalid date',
    (input) => {
      input.dateOfWork = '2026-02-30';
    },
  ],
  [
    'future date',
    (input) => {
      input.dateOfWork = moment().tz('America/Los_Angeles').add(1, 'day').format('YYYY-MM-DD');
    },
  ],
  [
    'short session key',
    (input) => {
      input.batchId = 'short';
    },
  ],
  [
    'no allocations',
    (input) => {
      input.allocations = [];
    },
  ],
  [
    'one allocation',
    (input) => {
      input.allocations.pop();
    },
  ],
  [
    'missing row',
    (input) => {
      input.allocations[1] = null;
    },
  ],
  [
    'malformed task ID',
    (input) => {
      input.allocations[0].taskId = 'bad';
    },
  ],
  [
    'duplicate case-insensitive task',
    (input) => {
      input.allocations[1].taskId = input.allocations[0].taskId.toUpperCase();
    },
  ],
  [
    'fractional minutes',
    (input) => {
      input.allocations[0].minutes = 180.5;
    },
  ],
  [
    'negative minutes',
    (input) => {
      input.allocations[0].minutes = -1;
    },
  ],
  [
    'zero minutes',
    (input) => {
      input.allocations[0].minutes = 0;
    },
  ],
  [
    'wrong total',
    (input) => {
      input.totalMinutes = 299;
    },
  ],
  [
    'unbounded total',
    (input) => {
      input.totalMinutes = 60001;
    },
  ],
  [
    'empty description',
    (input) => {
      input.allocations[0].notes = '';
    },
  ],
  [
    'missing reference',
    (input) => {
      input.allocations[0].notes = notes.replace('https://example.org/pr', 'no reference here');
    },
  ],
  [
    'oversized description',
    (input) => {
      input.allocations[0].notes = 'a'.repeat(10001);
    },
  ],
])('rejects %s', (_name, change) => {
  const input = makeInput();
  change(input);
  expect(() => normalizeSplitTimeEntry(input, user)).toThrow();
});

test('receipt IDs cannot be used to read another account’s split', () => {
  expect(splitReceiptId(user, makeInput().batchId)).not.toBe(
    splitReceiptId('dddddddddddddddddddddddd', makeInput().batchId),
  );
  expect(() => splitReceiptId(undefined, makeInput().batchId)).toThrow('Authentication required');
  expect(() => splitReceiptId(user, '../invalid')).toThrow();
});
