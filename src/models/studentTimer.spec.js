const mongoose = require('mongoose');
const Timer = require('./studentTimer');

const makeTimer = (fields) =>
  new Timer({
    userId: new mongoose.Types.ObjectId(),
    durationMs: 60 * 1000,
    ...fields,
  });

describe('studentTimer summarize() — overtime is never clamped', () => {
  it('reports elapsed under the target with no overtime', () => {
    const summary = makeTimer({ status: 'paused', elapsedMs: 30 * 1000 }).summarize();

    expect(summary.elapsedMs).toBe(30 * 1000);
    expect(summary.remainingMs).toBe(30 * 1000);
    expect(summary.overtimeMs).toBe(0);
    expect(summary.isOvertime).toBe(false);
  });

  it('reports full elapsed and overtime once past the target (31 min against a 1 min target)', () => {
    const thirtyOneMinutesMs = 31 * 60 * 1000;
    const summary = makeTimer({ status: 'paused', elapsedMs: thirtyOneMinutesMs }).summarize();

    expect(summary.elapsedMs).toBe(thirtyOneMinutesMs);
    expect(summary.remainingMs).toBe(0);
    expect(summary.overtimeMs).toBe(thirtyOneMinutesMs - 60 * 1000);
    expect(summary.isOvertime).toBe(true);
  });

  it('reports 61 minutes as 61 minutes, not truncated and not inflated', () => {
    const sixtyOneMinutesMs = 61 * 60 * 1000;
    const summary = makeTimer({ status: 'paused', elapsedMs: sixtyOneMinutesMs }).summarize();

    expect(summary.elapsedMs).toBe(sixtyOneMinutesMs);
    expect(summary.overtimeMs).toBe(sixtyOneMinutesMs - 60 * 1000);
  });

  it('keeps display progress within 0..1 even deep into overtime', () => {
    const summary = makeTimer({ status: 'paused', elapsedMs: 10 * 60 * 1000 }).summarize();

    expect(summary.progress).toBe(1);
    expect(summary.progress).toBeLessThanOrEqual(1);
  });

  it('accrues overtime for a running timer from startedAt (refresh/status recovery)', () => {
    const summary = makeTimer({
      status: 'running',
      elapsedMs: 0,
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
    }).summarize();

    expect(summary.elapsedMs).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(summary.isOvertime).toBe(true);
    expect(summary.overtimeMs).toBeGreaterThan(0);
  });

  it('exposes the exact sessionStartedAt and endedAt timestamps', () => {
    const startedAt = new Date('2026-01-01T10:00:00.000Z');
    const endedAt = new Date('2026-01-01T10:31:00.000Z');
    const summary = makeTimer({
      status: 'stopped',
      elapsedMs: 31 * 60 * 1000,
      sessionStartedAt: startedAt,
      endedAt,
    }).summarize();

    expect(summary.sessionStartedAt.toISOString()).toBe('2026-01-01T10:00:00.000Z');
    expect(summary.endedAt.toISOString()).toBe('2026-01-01T10:31:00.000Z');
  });
});

describe('studentTimer schema defaults and validation', () => {
  it('defaults a new timer to idle with nothing accrued', () => {
    const timer = makeTimer();

    expect(timer.status).toBe('idle');
    expect(timer.elapsedMs).toBe(0);
    expect(timer.note).toBe('');
    expect(timer.taskId).toBeNull();
    expect(timer.startedAt).toBeNull();
    expect(timer.pausedAt).toBeNull();
    expect(timer.sessionStartedAt).toBeNull();
    expect(timer.endedAt).toBeNull();
    expect(timer.sessionUuid).toBeNull();
    expect(timer.activityLogId).toBeNull();
  });

  it('requires a userId', () => {
    const error = new Timer({ durationMs: 60 * 1000 }).validateSync();

    expect(error.errors.userId).toBeDefined();
  });

  it('requires a durationMs', () => {
    const error = new Timer({ userId: new mongoose.Types.ObjectId() }).validateSync();

    expect(error.errors.durationMs).toBeDefined();
  });

  it('rejects a zero or negative durationMs', () => {
    expect(makeTimer({ durationMs: 0 }).validateSync().errors.durationMs).toBeDefined();
    expect(makeTimer({ durationMs: -1 }).validateSync().errors.durationMs).toBeDefined();
  });

  it('rejects a negative elapsedMs', () => {
    expect(makeTimer({ elapsedMs: -1 }).validateSync().errors.elapsedMs).toBeDefined();
  });

  it('rejects a status outside the allowed lifecycle states', () => {
    const error = makeTimer({ status: 'sprinting' }).validateSync();

    expect(error.errors.status).toBeDefined();
  });

  it.each(['idle', 'running', 'paused', 'stopped', 'archived'])(
    'accepts the %s lifecycle state',
    (status) => {
      expect(makeTimer({ status }).validateSync()).toBeUndefined();
    },
  );
});

describe('studentTimer summarize() — degenerate states', () => {
  it('reports zero progress for a timer with no duration instead of dividing by zero', () => {
    const summary = makeTimer({ durationMs: 0, status: 'paused', elapsedMs: 5000 }).summarize();

    expect(summary.progress).toBe(0);
    expect(Number.isNaN(summary.progress)).toBe(false);
    expect(summary.remainingMs).toBe(0);
    expect(summary.overtimeMs).toBe(5000);
  });

  it('accrues nothing for a running timer whose startedAt was lost', () => {
    const summary = makeTimer({
      status: 'running',
      elapsedMs: 90 * 1000,
      startedAt: null,
    }).summarize();

    expect(summary.elapsedMs).toBe(90 * 1000);
    expect(summary.isOvertime).toBe(true);
  });

  it('does not accrue wall-clock time for a stopped timer', () => {
    const summary = makeTimer({
      status: 'stopped',
      elapsedMs: 30 * 1000,
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
    }).summarize();

    expect(summary.elapsedMs).toBe(30 * 1000);
    expect(summary.remainingMs).toBe(30 * 1000);
  });

  it('breaks the remaining time down into hours, minutes and seconds', () => {
    const summary = makeTimer({
      durationMs: 2 * 3600 * 1000 + 5 * 60 * 1000 + 9 * 1000,
      status: 'paused',
      elapsedMs: 0,
    }).summarize();

    expect(summary.remaining).toEqual({ hours: 2, minutes: 5, seconds: 9 });
  });

  it('reports a zeroed remaining breakdown once the target is passed', () => {
    const summary = makeTimer({ status: 'paused', elapsedMs: 10 * 60 * 1000 }).summarize();

    expect(summary.remaining).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    expect(summary.remainingMs).toBe(0);
  });
});
