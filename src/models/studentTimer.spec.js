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
