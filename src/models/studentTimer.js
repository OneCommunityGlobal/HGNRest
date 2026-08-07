const mongoose = require('mongoose');

const STATUS = ['idle', 'running', 'paused', 'stopped', 'archived'];

const TimerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'userProfile',
      required: true,
      index: true,
    },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'task', default: null, index: true },

    status: { type: String, enum: STATUS, default: 'idle', index: true },

    durationMs: { type: Number, required: true, min: 1 },

    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    // Set once when the session first starts and never overwritten by
    // pause/resume, so the true session start survives a stop() call
    // (unlike startedAt, which is re-stamped on every resume).
    sessionStartedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    // Stable per-session UUID. Doubles as the ActivityLog entity_id (which the
    // ActivityLog schema validates as a UUID) and as the idempotency key that
    // makes stop -> time_logged creation at-most-once across retries.
    sessionUuid: { type: String, default: null, index: true },
    // Set once the time_logged ActivityLog entry exists, so a replayed stop
    // short-circuits instead of creating a second entry.
    activityLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityLog', default: null },
    elapsedMs: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

TimerSchema.index({ userId: 1, status: 1, updatedAt: -1 });

TimerSchema.methods.summarize = function summarize() {
  const now = Date.now();
  let runningElapsed = 0;
  if (this.status === 'running' && this.startedAt) {
    runningElapsed = now - this.startedAt.getTime();
  }
  // durationMs is a target, not a ceiling: elapsed is never clamped to it, so
  // work past the countdown target is recorded in full (overtime).
  const elapsed = Math.max(0, this.elapsedMs + runningElapsed);
  const remainingMs = Math.max(0, this.durationMs - elapsed);
  const overtimeMs = Math.max(0, elapsed - this.durationMs);
  // Progress is display-only and stays within 0..1 so the progress ring/bar
  // cannot overflow, even though elapsed itself is uncapped.
  const rawProgress = this.durationMs > 0 ? elapsed / this.durationMs : 0;
  const progress = Math.min(1, rawProgress);

  const secs = Math.floor(remainingMs / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return {
    _id: this._id,
    status: this.status,
    durationMs: this.durationMs,
    elapsedMs: elapsed,
    remainingMs,
    overtimeMs,
    isOvertime: overtimeMs > 0,
    remaining: { hours: h, minutes: m, seconds: s },
    progress,
    startedAt: this.startedAt,
    pausedAt: this.pausedAt,
    sessionStartedAt: this.sessionStartedAt,
    endedAt: this.endedAt,
    activityLogId: this.activityLogId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    userId: this.userId,
    taskId: this.taskId,
    note: this.note,
  };
};

module.exports = mongoose.model('Timer', TimerSchema);
