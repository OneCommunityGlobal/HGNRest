const Timer = require("../models/studentTimer");
const mongoose = require("mongoose");

function assertObjectId(id, name = "id") {
  if (!id || !mongoose.isValidObjectId(id)) {
    const e = new Error(`${name} is required and must be a valid ObjectId`);
    e.status = 400;
    throw e;
  }
}

function validateHM(hours, minutes) {
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    const e = new Error("hours and minutes must be numbers");
    e.status = 400; throw e;
  }
  if (h < 0 || h > 23) { const e = new Error("hours must be between 0 and 23"); e.status = 400; throw e; }
  if (m < 0 || m > 59) { const e = new Error("minutes must be between 0 and 59"); e.status = 400; throw e; }
  const totalMs = (h * 60 + m) * 60 * 1000;
  if (totalMs <= 0) { const e = new Error("duration must be > 0"); e.status = 400; throw e; }
  return totalMs;
}

async function getActiveTimer(userId) {
  return Timer.findOne({ userId, status: { $in: ["running", "paused"] } }).sort({ updatedAt: -1 });
}

async function start({ userId, taskId = null, hours, minutes, note = "" }) {
  assertObjectId(userId, "userId");
  if (taskId) assertObjectId(taskId, "taskId");
  const durationMs = validateHM(hours, minutes);

  const existing = await getActiveTimer(userId);
  if (existing) {
    if (existing.status === "running" && existing.startedAt) {
      existing.elapsedMs += Date.now() - existing.startedAt.getTime();
    }
    existing.elapsedMs = Math.min(existing.elapsedMs, existing.durationMs);
    existing.status = "stopped";
    existing.startedAt = null;
    existing.pausedAt = null;
    await existing.save();
  }

  const timer = await Timer.create({
    userId,
    taskId: taskId || null,
    status: "running",
    durationMs,
    startedAt: new Date(),
    pausedAt: null,
    elapsedMs: 0,
    note,
  });

  return timer.summarize();
}

async function pause({ userId }) {
  assertObjectId(userId, "userId");
  const timer = await getActiveTimer(userId);
  if (!timer || timer.status !== "running") {
    const e = new Error("Timer is not running");
    e.status = 409; throw e;
  }
  if (timer.startedAt) {
    timer.elapsedMs += Date.now() - timer.startedAt.getTime();
  }
  timer.status = "paused";
  timer.startedAt = null;
  timer.pausedAt = new Date();
  await timer.save();
  return timer.summarize();
}

async function resume({ userId }) {
  assertObjectId(userId, "userId");
  const timer = await getActiveTimer(userId);
  if (!timer || timer.status !== "paused") {
    const e = new Error("Timer is not paused");
    e.status = 409; throw e;
  }
  if (timer.elapsedMs >= timer.durationMs) {
    timer.status = "stopped";
    timer.startedAt = null;
    timer.pausedAt = null;
    await timer.save();
    const e = new Error("Timer already completed");
    e.status = 409; e.payload = timer.summarize(); throw e;
  }
  timer.status = "running";
  timer.startedAt = new Date();
  timer.pausedAt = null;
  await timer.save();
  return timer.summarize();
}

async function stop({ userId }) {
  assertObjectId(userId, "userId");
  const timer = await getActiveTimer(userId);
  if (!timer) {
    const e = new Error("No active timer");
    e.status = 409; throw e;
  }
  if (timer.status === "running" && timer.startedAt) {
    timer.elapsedMs += Date.now() - timer.startedAt.getTime();
  }
  timer.elapsedMs = Math.min(timer.elapsedMs, timer.durationMs);
  timer.status = "stopped";
  timer.startedAt = null;
  timer.pausedAt = null;
  await timer.save();
  return timer.summarize();
}

async function status({ userId }) {
  assertObjectId(userId, "userId");
  const timer = await getActiveTimer(userId);
  if (!timer) return { status: "idle" };
  return timer.summarize();
}

async function reset({ userId }) {
  assertObjectId(userId, "userId");
  await Timer.updateMany({ userId, status: { $in: ["running", "paused"] } }, { $set: { status: "stopped", startedAt: null, pausedAt: null } });
  return { status: "idle" };
}

async function history({ userId, page = 1, limit = 20 }) {
  assertObjectId(userId, "userId");
  const skip = Math.max(0, (Number(page) - 1) * Number(limit));
  const [items, total] = await Promise.all([
    Timer.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Timer.countDocuments({ userId }),
  ]);
  return {
    page: Number(page),
    limit: Number(limit),
    total,
    items: items.map((t) => t.summarize()),
  };
}

async function stats({ userId, from, to }) {
  assertObjectId(userId, "userId");
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }
  
  const rows = await Timer.aggregate([
    { $match: match },
    {
      $project: {
        createdAt: 1,
        elapsedMs: {
          $cond: [{ $gt: ["$elapsedMs", "$durationMs"] }, "$durationMs", "$elapsedMs"]
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } },
        totalMs: { $sum: "$elapsedMs" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    date: r._id,
    totalMs: r.totalMs,
    totalHours: +(r.totalMs / 3600000).toFixed(2),
    entries: r.count,
  }));
}

async function adjustDuration({ userId, deltaMinutes }) {
  assertObjectId(userId, "userId");

  const timer = await getActiveTimer(userId);
  if (!timer) {
    const e = new Error("No active timer");
    e.status = 404;
    throw e;
  }

  const deltaMs = Number(deltaMinutes) * 60 * 1000;
  timer.durationMs = Math.max(60 * 1000, timer.durationMs + deltaMs);

  await timer.save();
  return timer.summarize();
}


module.exports = {
  start,
  pause,
  resume,
  stop,
  status,
  reset,
  history,
  stats,
  adjustDuration,
};
