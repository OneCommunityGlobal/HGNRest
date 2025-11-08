const mongoose = require("mongoose");

const STATUS = ["idle", "running", "paused", "stopped", "archived"];

const TimerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "userProfile", required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "task", default: null, index: true },

    status: { type: String, enum: STATUS, default: "idle", index: true },

    durationMs: { type: Number, required: true, min: 1 },

    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    elapsedMs: { type: Number, default: 0, min: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

TimerSchema.index({ userId: 1, status: 1, updatedAt: -1 });

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

TimerSchema.methods.summarize = function summarize() {
  const now = Date.now();
  let runningElapsed = 0;
  if (this.status === "running" && this.startedAt) {
    runningElapsed = now - this.startedAt.getTime();
  }
  const elapsed = clamp(this.elapsedMs + runningElapsed, 0, this.durationMs);
  const remainingMs = Math.max(0, this.durationMs - elapsed);
  const progress = this.durationMs > 0 ? elapsed / this.durationMs : 0;

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
    remaining: { hours: h, minutes: m, seconds: s },
    progress,
    startedAt: this.startedAt,
    pausedAt: this.pausedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    userId: this.userId,
    taskId: this.taskId,
    note: this.note,
  };
};

module.exports = mongoose.model("Timer", TimerSchema);
