jest.mock('../models/studentTimer', () => {
  const mockModel = jest.fn();
  mockModel.findOne = jest.fn();
  mockModel.findById = jest.fn();
  mockModel.findOneAndUpdate = jest.fn();
  mockModel.create = jest.fn();
  mockModel.updateMany = jest.fn();
  return mockModel;
});

jest.mock('../models/educationTask', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/activityLog', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

const Timer = require('../models/studentTimer');
const EducationTask = require('../models/educationTask');
const ActivityLog = require('../models/activityLog');
const service = require('./studentTimerService');

const validUserId = '65cf6c3706d8ac105827bb2e';
const validTaskId = '65cf6c3706d8ac105827bb2f';
const otherStudentTaskId = '65cf6c3706d8ac105827bb30';
const SESSION_UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const makeTimerDoc = (overrides) => ({
  userId: validUserId,
  taskId: validTaskId,
  status: 'running',
  durationMs: 7200000,
  elapsedMs: 0,
  startedAt: new Date(),
  pausedAt: null,
  sessionStartedAt: new Date(),
  endedAt: null,
  sessionUuid: SESSION_UUID,
  activityLogId: null,
  save: jest.fn().mockResolvedValue(undefined),
  summarize: jest.fn().mockReturnValue({ status: 'summarized' }),
  ...overrides,
});

const mockSort = (doc) => ({ sort: jest.fn().mockResolvedValue(doc) });

/**
 * Emulates the real atomic semantics of the two guarded findOneAndUpdate calls
 * against a single in-memory timer document, so concurrency can be exercised
 * rather than assumed: each guarded transition succeeds for exactly one caller.
 */
const installAtomicTimerMock = (doc) => {
  Timer.findById.mockImplementation(async () => doc);
  Timer.findOneAndUpdate.mockImplementation(async (filter, update) => {
    const set = update.$set || {};

    // Guarded stop: only while still running/paused.
    if (filter.status && filter.status.$in) {
      if (!filter.status.$in.includes(doc.status)) return null;
      Object.assign(doc, set);
      return doc;
    }

    // Guarded log claim: only while activityLogId is still null.
    if (Object.prototype.hasOwnProperty.call(filter, 'activityLogId')) {
      if (doc.activityLogId !== null && doc.activityLogId !== undefined) return null;
      Object.assign(doc, set);
      return doc;
    }

    Object.assign(doc, set);
    return doc;
  });
  return doc;
};

/**
 * Emulates MongoDB's `_id` primary key, which is uniquely indexed by default.
 * This is the constraint the at-most-once guarantee actually rests on, so the
 * store rejects a second insert of the same `_id` with a real E11000, letting
 * the tests assert how many documents genuinely persist.
 */
let activityLogStore;

const installActivityLogStore = () => {
  activityLogStore = new Map();
  ActivityLog.findById.mockImplementation(async (id) => activityLogStore.get(String(id)) || null);
  ActivityLog.create.mockImplementation(async (doc) => {
    const key = String(doc._id);
    if (activityLogStore.has(key)) {
      throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
    }
    activityLogStore.set(key, doc);
    return doc;
  });
};

describe('studentTimerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EducationTask.findOne.mockResolvedValue({ _id: validTaskId, studentId: validUserId });
    ActivityLog.findOne.mockResolvedValue(null);
    installActivityLogStore();
  });

  describe('start', () => {
    it('rejects an invalid userId', async () => {
      await expect(
        service.start({ userId: 'not-an-id', hours: 1, minutes: 0 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an invalid taskId', async () => {
      await expect(
        service.start({ userId: validUserId, taskId: 'bad-id', hours: 1, minutes: 0 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a taskId that is not assigned to this student (authorization)', async () => {
      EducationTask.findOne.mockResolvedValue(null);

      await expect(
        service.start({
          userId: validUserId,
          taskId: otherStudentTaskId,
          hours: 1,
          minutes: 0,
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(EducationTask.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.anything(),
          studentId: expect.anything(),
        }),
      );
    });

    it('rejects minutes outside 0-59 (regression: frontend must send minutes, not total minutes)', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      await expect(
        service.start({ userId: validUserId, taskId: validTaskId, hours: 2, minutes: 120 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects hours outside 0-23', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      await expect(
        service.start({ userId: validUserId, taskId: validTaskId, hours: 24, minutes: 0 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a zero duration', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      await expect(
        service.start({ userId: validUserId, taskId: validTaskId, hours: 0, minutes: 0 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('auto-stops an existing running timer before starting a new one (prevents duplicate active sessions)', async () => {
      const existing = makeTimerDoc({ status: 'running', elapsedMs: 1000 });
      Timer.findOne.mockReturnValue(mockSort(existing));
      Timer.create.mockResolvedValue(makeTimerDoc());

      await service.start({ userId: validUserId, taskId: validTaskId, hours: 1, minutes: 0 });

      expect(existing.save).toHaveBeenCalled();
      expect(existing.status).toBe('stopped');
      expect(Timer.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: validUserId, taskId: validTaskId, status: 'running' }),
      );
    });

    it('creates a running timer with the correct duration and a preserved sessionStartedAt', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      Timer.create.mockResolvedValue(makeTimerDoc());

      await service.start({ userId: validUserId, taskId: validTaskId, hours: 1, minutes: 30 });

      expect(Timer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: (60 + 30) * 60 * 1000,
          sessionStartedAt: expect.any(Date),
          endedAt: null,
        }),
      );
    });

    it('allows starting without a taskId (task association is optional at the service layer)', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      Timer.create.mockResolvedValue(makeTimerDoc());

      await service.start({ userId: validUserId, hours: 0, minutes: 30 });

      expect(EducationTask.findOne).not.toHaveBeenCalled();
      expect(Timer.create).toHaveBeenCalledWith(expect.objectContaining({ taskId: null }));
    });
  });

  describe('pause', () => {
    it('rejects when there is no running timer', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      await expect(service.pause({ userId: validUserId })).rejects.toMatchObject({ status: 409 });
    });

    it('pauses a running timer and accumulates elapsed time', async () => {
      const timer = makeTimerDoc({ status: 'running', elapsedMs: 0 });
      Timer.findOne.mockReturnValue(mockSort(timer));

      await service.pause({ userId: validUserId });

      expect(timer.status).toBe('paused');
      expect(timer.save).toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('rejects when there is no paused timer', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      await expect(service.resume({ userId: validUserId })).rejects.toMatchObject({
        status: 409,
      });
    });

    it('resumes into overtime once the countdown target is already reached', async () => {
      const timer = makeTimerDoc({ status: 'paused', elapsedMs: 7200000, durationMs: 7200000 });
      Timer.findOne.mockReturnValue(mockSort(timer));

      const result = await service.resume({ userId: validUserId });

      expect(timer.status).toBe('running');
      expect(timer.startedAt).toBeInstanceOf(Date);
      expect(result).toBeDefined();
    });

    it('resumes a timer already past its target without discarding accrued overtime', async () => {
      const timer = makeTimerDoc({ status: 'paused', elapsedMs: 200000, durationMs: 60000 });
      Timer.findOne.mockReturnValue(mockSort(timer));

      await service.resume({ userId: validUserId });

      expect(timer.status).toBe('running');
      expect(timer.elapsedMs).toBe(200000);
    });
  });

  describe('stop → server-generated time_logged ActivityLog', () => {
    it('creates exactly one time_logged entry from authoritative stored values', async () => {
      const thirtyOneMinutesMs = 31 * 60 * 1000;
      const sessionStart = new Date('2026-01-01T10:00:00.000Z');
      const timer = installAtomicTimerMock(
        makeTimerDoc({
          status: 'running',
          durationMs: 60 * 1000,
          elapsedMs: 0,
          startedAt: new Date(Date.now() - thirtyOneMinutesMs),
          sessionStartedAt: sessionStart,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      const result = await service.stop({ userId: validUserId });

      expect(activityLogStore.size).toBe(1);
      const created = ActivityLog.create.mock.calls[0][0];

      // Authenticated student, not any client-supplied id.
      expect(created.actor_id).toBe(validUserId);
      expect(created.action_type).toBe('time_logged');
      // entity_id is the session UUID (satisfies the schema's UUID validation).
      expect(created.entity_id).toBe(SESSION_UUID);
      expect(created.metadata.taskId).toBe(String(validTaskId));
      // Exact uncapped elapsed, including overtime past the 1-minute target.
      expect(created.metadata.durationMs).toBeGreaterThanOrEqual(thirtyOneMinutesMs);
      expect(created.metadata.durationMs).toBeLessThan(thirtyOneMinutesMs + 5000);
      expect(created.metadata.durationMs).toBeGreaterThan(timer.durationMs);
      // Original session start, and the backend stop timestamp.
      expect(created.metadata.startedAt).toBe(sessionStart);
      expect(created.metadata.endedAt).toBeInstanceOf(Date);

      // The log is written under the id claimed on the timer beforehand.
      expect(timer.activityLogId).toBeTruthy();
      expect(String(created._id)).toBe(String(timer.activityLogId));
      expect(String(result.activityLogId)).toBe(String(timer.activityLogId));
      expect(result.recovered).toBe(false);
    });

    it('does not create a log for a zero-duration session', async () => {
      const timer = installAtomicTimerMock(
        makeTimerDoc({ status: 'paused', elapsedMs: 0, startedAt: null }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      const result = await service.stop({ userId: validUserId });

      expect(ActivityLog.create).not.toHaveBeenCalled();
      expect(result.activityLogId).toBeNull();
    });

    it('is idempotent: a timer whose claimed log already exists creates no second entry (lost-response replay)', async () => {
      // The claim and its document are both already in place, as they would be
      // when a client retries after losing the first response.
      activityLogStore.set('existing-log-id', { _id: 'existing-log-id' });
      const timer = installAtomicTimerMock(
        makeTimerDoc({
          status: 'running',
          elapsedMs: 60000,
          startedAt: new Date(Date.now() - 1000),
          activityLogId: 'existing-log-id',
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      const result = await service.stop({ userId: validUserId });

      expect(ActivityLog.create).not.toHaveBeenCalled();
      expect(activityLogStore.size).toBe(1);
      expect(result.activityLogId).toBe('existing-log-id');
    });

    it('recovers a stopped-but-unlogged session instead of losing it (consistency repair)', async () => {
      const stoppedUnlogged = installAtomicTimerMock(
        makeTimerDoc({
          status: 'stopped',
          elapsedMs: 120000,
          startedAt: null,
          endedAt: new Date(),
          activityLogId: null,
        }),
      );
      // First lookup (active timer) finds nothing; second (recovery) finds it.
      Timer.findOne
        .mockReturnValueOnce(mockSort(null))
        .mockReturnValueOnce(mockSort(stoppedUnlogged));

      const result = await service.stop({ userId: validUserId });

      expect(activityLogStore.size).toBe(1);
      expect(result.recovered).toBe(true);
      expect(result.activityLogId).toBeTruthy();
    });

    it('rejects the stop if the task was unassigned from the student mid-session', async () => {
      EducationTask.findOne.mockResolvedValue(null);
      const timer = makeTimerDoc({
        status: 'running',
        elapsedMs: 60000,
        startedAt: new Date(Date.now() - 1000),
      });
      Timer.findOne.mockReturnValue(mockSort(timer));

      await expect(service.stop({ userId: validUserId })).rejects.toMatchObject({ status: 404 });
      expect(ActivityLog.create).not.toHaveBeenCalled();
    });

    it('preserves duration across pause/resume when logging', async () => {
      // 150s already banked while paused, then 30s more running.
      const timer = installAtomicTimerMock(
        makeTimerDoc({
          status: 'running',
          durationMs: 60 * 1000,
          elapsedMs: 150 * 1000,
          startedAt: new Date(Date.now() - 30 * 1000),
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      await service.stop({ userId: validUserId });

      const created = ActivityLog.create.mock.calls[0][0];
      expect(created.metadata.durationMs).toBeGreaterThanOrEqual(180 * 1000);
      expect(created.metadata.durationMs).toBeLessThan(185 * 1000);
    });
  });

  describe('concurrency and session lifecycle', () => {
    it('two concurrent Stop requests create exactly one ActivityLog', async () => {
      const doc = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-1',
          status: 'running',
          elapsedMs: 60000,
          startedAt: new Date(Date.now() - 1000),
          activityLogId: null,
        }),
      );
      // Both requests observe the same still-running timer, as they would when
      // arriving together.
      Timer.findOne.mockReturnValue(mockSort(doc));

      const [first, second] = await Promise.all([
        service.stop({ userId: validUserId }),
        service.stop({ userId: validUserId }),
      ]);

      // Exactly one document persists, enforced by the _id primary key.
      expect(activityLogStore.size).toBe(1);
      // Both callers resolve safely and agree on the same log.
      expect(first.activityLogId).toBeTruthy();
      expect(second.activityLogId).toBeTruthy();
      expect(String(first.activityLogId)).toBe(String(second.activityLogId));
      // Exactly one caller won the stop transition.
      expect([first.recovered, second.recovered].filter(Boolean)).toHaveLength(1);
    });

    it('two concurrent Stop requests from separate tabs still create only one entry', async () => {
      const doc = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-tabs',
          status: 'paused',
          elapsedMs: 120000,
          startedAt: null,
          activityLogId: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(doc));

      await Promise.all([
        service.stop({ userId: validUserId }),
        service.stop({ userId: validUserId }),
      ]);

      expect(activityLogStore.size).toBe(1);
      expect(doc.activityLogId).toBeTruthy();
    });

    it('a genuinely new session creates a second, distinct ActivityLog', async () => {
      const first = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-a',
          status: 'running',
          elapsedMs: 60000,
          startedAt: new Date(Date.now() - 1000),
          activityLogId: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(first));
      const resultA = await service.stop({ userId: validUserId });

      const second = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-b',
          status: 'running',
          elapsedMs: 90000,
          startedAt: new Date(Date.now() - 1000),
          activityLogId: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(second));
      const resultB = await service.stop({ userId: validUserId });

      expect(ActivityLog.create).toHaveBeenCalledTimes(2);
      expect(String(resultA.activityLogId)).not.toBe(String(resultB.activityLogId));
    });

    it('starting a new session generates a fresh sessionUuid and a null activityLogId', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      Timer.create.mockImplementation(async (doc) => makeTimerDoc(doc));

      await service.start({ userId: validUserId, taskId: validTaskId, hours: 0, minutes: 30 });
      const firstCreate = Timer.create.mock.calls[0][0];

      await service.start({ userId: validUserId, taskId: validTaskId, hours: 0, minutes: 30 });
      const secondCreate = Timer.create.mock.calls[1][0];

      expect(firstCreate.sessionUuid).toBeTruthy();
      expect(secondCreate.sessionUuid).toBeTruthy();
      expect(firstCreate.sessionUuid).not.toBe(secondCreate.sessionUuid);
      expect(firstCreate.activityLogId).toBeNull();
      expect(secondCreate.activityLogId).toBeNull();
    });

    it('logs a superseded session on start so it cannot later be mistaken for a newer one', async () => {
      const superseded = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-superseded',
          status: 'running',
          elapsedMs: 45000,
          startedAt: new Date(Date.now() - 1000),
          activityLogId: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(superseded));
      Timer.create.mockImplementation(async (doc) => makeTimerDoc(doc));

      await service.start({ userId: validUserId, taskId: validTaskId, hours: 0, minutes: 30 });

      // The superseded session is logged immediately and now carries a log id,
      // so the stop() repair path can never pick it up as an unlogged session.
      expect(ActivityLog.create).toHaveBeenCalledTimes(1);
      expect(superseded.activityLogId).toBeTruthy();
    });

    it('reset clears every session identifier and timestamp so the session cannot be repaired later', async () => {
      Timer.updateMany.mockResolvedValue({ acknowledged: true });

      await service.reset({ userId: validUserId });

      const [, update] = Timer.updateMany.mock.calls[0];
      expect(update.$set).toMatchObject({
        status: 'stopped',
        startedAt: null,
        pausedAt: null,
        endedAt: null,
        sessionStartedAt: null,
        sessionUuid: null,
        activityLogId: null,
        elapsedMs: 0,
      });
    });

    it('a zero-duration stop writes no log and does not block a later session', async () => {
      const zero = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-zero',
          status: 'paused',
          elapsedMs: 0,
          startedAt: null,
          activityLogId: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(zero));

      const zeroResult = await service.stop({ userId: validUserId });
      expect(zeroResult.activityLogId).toBeNull();
      expect(ActivityLog.create).not.toHaveBeenCalled();

      // A later, real session still logs normally.
      const next = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-next',
          status: 'running',
          elapsedMs: 30000,
          startedAt: new Date(Date.now() - 1000),
          activityLogId: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(next));

      const nextResult = await service.stop({ userId: validUserId });
      expect(ActivityLog.create).toHaveBeenCalledTimes(1);
      expect(nextResult.activityLogId).toBeTruthy();
    });

    it('does not resurrect an already-logged session on a duplicate stop', async () => {
      const logged = makeTimerDoc({
        _id: 'timer-done',
        status: 'stopped',
        elapsedMs: 60000,
        startedAt: null,
        activityLogId: 'already-logged',
      });
      // No active timer; the most recent stopped session is fully logged.
      Timer.findOne.mockReturnValueOnce(mockSort(null)).mockReturnValueOnce(mockSort(logged));
      ActivityLog.findById.mockResolvedValue({ _id: 'already-logged' });

      await expect(service.stop({ userId: validUserId })).rejects.toMatchObject({ status: 409 });
      expect(ActivityLog.create).not.toHaveBeenCalled();
    });

    it('repairs a claimed-but-never-written log without creating a duplicate', async () => {
      const claimedNotWritten = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-claimed',
          status: 'stopped',
          elapsedMs: 60000,
          startedAt: null,
          activityLogId: 'claimed-id',
        }),
      );
      Timer.findOne
        .mockReturnValueOnce(mockSort(null))
        .mockReturnValueOnce(mockSort(claimedNotWritten));
      // The claim exists but the document never landed.
      ActivityLog.findById.mockResolvedValue(null);

      const result = await service.stop({ userId: validUserId });

      expect(result.recovered).toBe(true);
      expect(ActivityLog.create).toHaveBeenCalledTimes(1);
      // Re-inserted under the originally claimed id, so it stays at-most-once.
      expect(ActivityLog.create.mock.calls[0][0]._id).toBe('claimed-id');
    });

    it('treats a duplicate-key insert as already written rather than failing', async () => {
      const doc = installAtomicTimerMock(
        makeTimerDoc({
          _id: 'timer-dup',
          status: 'running',
          elapsedMs: 60000,
          startedAt: new Date(Date.now() - 1000),
          activityLogId: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(doc));
      const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      ActivityLog.create.mockRejectedValueOnce(duplicateKeyError);

      const result = await service.stop({ userId: validUserId });

      expect(result.activityLogId).toBeTruthy();
    });
  });

  describe('stop', () => {
    it('rejects a duplicate stop request when there is no active timer and nothing to recover', async () => {
      Timer.findOne.mockReturnValue(mockSort(null));
      await expect(service.stop({ userId: validUserId })).rejects.toMatchObject({ status: 409 });
      expect(ActivityLog.create).not.toHaveBeenCalled();
    });

    it('stops a running timer and stamps endedAt', async () => {
      const timer = installAtomicTimerMock(
        makeTimerDoc({
          status: 'running',
          durationMs: 60000,
          elapsedMs: 0,
          startedAt: new Date(Date.now() - 30000),
          endedAt: null,
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      await service.stop({ userId: validUserId });

      expect(timer.status).toBe('stopped');
      expect(timer.endedAt).toBeInstanceOf(Date);
    });

    it('target 1 minute, stopped after 31 minutes → persists 31 minutes, not the 1-minute target', async () => {
      const oneMinuteTarget = 60 * 1000;
      const thirtyOneMinutesMs = 31 * 60 * 1000;
      const timer = installAtomicTimerMock(
        makeTimerDoc({
          status: 'running',
          durationMs: oneMinuteTarget,
          elapsedMs: 0,
          startedAt: new Date(Date.now() - thirtyOneMinutesMs),
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      await service.stop({ userId: validUserId });

      // Not truncated to the 1-minute target...
      expect(timer.elapsedMs).toBeGreaterThanOrEqual(thirtyOneMinutesMs);
      // ...and not inflated beyond the real elapsed time.
      expect(timer.elapsedMs).toBeLessThan(thirtyOneMinutesMs + 5000);
      expect(timer.elapsedMs).toBeGreaterThan(timer.durationMs);
    });

    it('target 1 minute, stopped after 61 minutes → persists 61 minutes', async () => {
      const sixtyOneMinutesMs = 61 * 60 * 1000;
      const timer = installAtomicTimerMock(
        makeTimerDoc({
          status: 'running',
          durationMs: 60 * 1000,
          elapsedMs: 0,
          startedAt: new Date(Date.now() - sixtyOneMinutesMs),
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      await service.stop({ userId: validUserId });

      expect(timer.elapsedMs).toBeGreaterThanOrEqual(sixtyOneMinutesMs);
      expect(timer.elapsedMs).toBeLessThan(sixtyOneMinutesMs + 5000);
    });

    it('accumulates paused overtime correctly across pause/resume', async () => {
      // Already 90s past a 60s target, then runs a further 30s before stopping.
      const timer = installAtomicTimerMock(
        makeTimerDoc({
          status: 'running',
          durationMs: 60 * 1000,
          elapsedMs: 150 * 1000,
          startedAt: new Date(Date.now() - 30 * 1000),
        }),
      );
      Timer.findOne.mockReturnValue(mockSort(timer));

      await service.stop({ userId: validUserId });

      expect(timer.elapsedMs).toBeGreaterThanOrEqual(180 * 1000);
      expect(timer.elapsedMs).toBeLessThan(185 * 1000);
    });
  });

  describe('reset', () => {
    it('rejects an invalid userId', async () => {
      await expect(service.reset({ userId: 'bad-id' })).rejects.toMatchObject({ status: 400 });
    });

    it('stops all running/paused timers for the user', async () => {
      Timer.updateMany.mockResolvedValue({ acknowledged: true });

      const result = await service.reset({ userId: validUserId });

      expect(Timer.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: { $in: ['running', 'paused'] } }),
        expect.objectContaining({ $set: expect.objectContaining({ status: 'stopped' }) }),
      );
      expect(result).toEqual({ status: 'idle' });
    });
  });
});
