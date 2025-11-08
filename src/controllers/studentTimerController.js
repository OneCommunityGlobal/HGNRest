const timers = new Map();

function getKey(req) {
  return (req.headers["x-user-id"] && String(req.headers["x-user-id"])) || req.ip;
}

function getOrInitTimer(key) {
  if (!timers.has(key)) {
    timers.set(key, {
      status: "idle",
      durationMs: 0,
      startedAt: null,
      elapsedMs: 0,
      pausedAt: null,
    });
  }
  return timers.get(key);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function validateHM(hours, minutes) {
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return { ok: false, message: "hours and minutes must be numbers" };
  }
  if (h < 0 || h > 23) return { ok: false, message: "hours must be between 0 and 23" };
  if (m < 0 || m > 59) return { ok: false, message: "minutes must be between 0 and 59" };
  const total = (h * 60 + m) * 60 * 1000;
  if (total <= 0) return { ok: false, message: "duration must be > 0" };
  return { ok: true, h, m, totalMs: total };
}

function nowMs() {
  return Date.now();
}

// compute remaining and progress for a timer
function summarize(timer) {
  let runningElapsed = 0;
  if (timer.status === "running" && timer.startedAt) {
    runningElapsed = nowMs() - timer.startedAt.getTime();
  }
  const elapsed = timer.elapsedMs + runningElapsed;
  const remainingMs = Math.max(0, timer.durationMs - elapsed);
  const progress = timer.durationMs > 0 ? clamp(elapsed / timer.durationMs, 0, 1) : 0;

  const secs = Math.floor(remainingMs / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return {
    status: timer.status,
    durationMs: timer.durationMs,
    elapsedMs: Math.min(elapsed, timer.durationMs),
    remainingMs,
    remaining: { hours: h, minutes: m, seconds: s },
    progress,
  };
}

function response(ok, data = null, error = null) {
  return { ok, data, error };
}

module.exports = {
  start: (req, res, next) => {
    try {
      const key = getKey(req);
      const t = getOrInitTimer(key);
      const { hours, minutes } = req.body || {};
      const v = validateHM(hours, minutes);
      if (!v.ok) return res.status(400).json(response(false, null, v.message));

      // start always creates a fresh timer
      t.status = "running";
      t.durationMs = v.totalMs;
      t.startedAt = new Date();
      t.elapsedMs = 0;
      t.pausedAt = null;

      return res.json(response(true, summarize(t), null));
    } catch (err) {
      next(err);
    }
  },

  pause: (req, res, next) => {
    try {
      const key = getKey(req);
      const t = getOrInitTimer(key);

      if (t.status !== "running") {
        return res.status(409).json(response(false, summarize(t), "Timer is not running"));
      }

      // accumulate elapsed until now
      if (t.startedAt) {
        t.elapsedMs += nowMs() - t.startedAt.getTime();
      }
      t.startedAt = null;
      t.pausedAt = new Date();
      t.status = "paused";

      return res.json(response(true, summarize(t), null));
    } catch (err) {
      next(err);
    }
  },

  resume: (req, res, next) => {
    try {
      const key = getKey(req);
      const t = getOrInitTimer(key);

      if (t.status !== "paused") {
        return res.status(409).json(response(false, summarize(t), "Timer is not paused"));
      }

      if (t.elapsedMs >= t.durationMs) {
        t.status = "stopped";
        t.startedAt = null;
        t.pausedAt = null;
        return res.status(409).json(response(false, summarize(t), "Timer already completed"));
      }

      t.status = "running";
      t.startedAt = new Date();
      t.pausedAt = null;

      return res.json(response(true, summarize(t), null));
    } catch (err) {
      next(err);
    }
  },

  stop: (req, res, next) => {
    try {
      const key = getKey(req);
      const t = getOrInitTimer(key);

      // mark as stopped and cap elapsed
      if (t.status === "running" && t.startedAt) {
        t.elapsedMs += nowMs() - t.startedAt.getTime();
      }
      t.elapsedMs = Math.min(t.elapsedMs, t.durationMs);
      t.status = "stopped";
      t.startedAt = null;
      t.pausedAt = null;

      return res.json(response(true, summarize(t), null));
    } catch (err) {
      next(err);
    }
  },

  status: (req, res, next) => {
    try {
      const key = getKey(req);
      const t = getOrInitTimer(key);
      return res.json(response(true, summarize(t), null));
    } catch (err) {
      next(err);
    }
  },

  reset: (req, res, next) => {
    try {
      const key = getKey(req);
      timers.delete(key);
      return res.json(response(true, { status: "idle" }, null));
    } catch (err) {
      next(err);
    }
  },
};
