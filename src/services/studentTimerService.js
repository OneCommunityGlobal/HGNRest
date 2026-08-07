const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Timer = require('../models/studentTimer');
const EducationTask = require('../models/educationTask');
const ActivityLog = require('../models/activityLog');

const TIME_LOGGED_ACTION = 'time_logged';

function assertObjectId(id, name = 'id') {
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
    const e = new Error('hours and minutes must be numbers');
    e.status = 400;
    throw e;
  }
  if (h < 0 || h > 23) {
    const e = new Error('hours must be between 0 and 23');
    e.status = 400;
    throw e;
  }
  if (m < 0 || m > 59) {
    const e = new Error('minutes must be between 0 and 59');
    e.status = 400;
    throw e;
  }
  const totalMs = (h * 60 + m) * 60 * 1000;
  if (totalMs <= 0) {
    const e = new Error('duration must be > 0');
    e.status = 400;
    throw e;
  }
  return totalMs;
}

async function getActiveTimer(userId) {
  const uid = new mongoose.Types.ObjectId(userId);
  return Timer.findOne({ userId: uid, status: { $in: ['running', 'paused'] } }).sort({
    updatedAt: -1,
  });
}

async function assertTaskAssignedToStudent(taskId, userId) {
  const task = await EducationTask.findOne({
    _id: new mongoose.Types.ObjectId(taskId),
    studentId: new mongoose.Types.ObjectId(userId),
  });
  if (!task) {
    const e = new Error('Task not found or not assigned to this student');
    e.status = 404;
    throw e;
  }
}

const DUPLICATE_KEY_CODE = 11000;

/**
 * Creates the single `time_logged` ActivityLog entry for a stopped timer, or
 * returns the one already claimed. Every value comes from the stored timer,
 * never from client input.
 *
 * At-most-once is guaranteed without any new index, because the claim is a
 * single atomic findOneAndUpdate on the timer and the write itself is keyed by
 * the ActivityLog `_id` (already uniquely indexed by MongoDB):
 *
 *  1. Pre-generate the log's `_id` and atomically claim it on the timer, but
 *     only while `activityLogId` is still null. Exactly one concurrent caller
 *     can win that transition; the losers read the winner's id.
 *  2. The winner inserts with that explicit `_id`. A racing insert of the same
 *     `_id` fails on the primary key (E11000), which we treat as "already
 *     written" rather than an error.
 *
 * Claiming before writing also removes the "log created but back-reference
 * lost" window entirely: if a claim exists with no document behind it, that is
 * unambiguously a failed write and is repaired by re-inserting the same `_id`.
 */
async function ensureTimeLoggedEntry(timer) {
  // Nothing measurable to record; documented rule is elapsedMs > 0.
  if (!timer.elapsedMs || timer.elapsedMs <= 0) return null;
  if (!timer.sessionUuid) return null;

  let logId = timer.activityLogId;

  if (!logId) {
    const candidateId = new mongoose.Types.ObjectId();
    const won = await Timer.findOneAndUpdate(
      { _id: timer._id, activityLogId: null },
      { $set: { activityLogId: candidateId } },
      { new: true },
    );

    if (won) {
      logId = candidateId;
      timer.activityLogId = candidateId;
    } else {
      // Another concurrent stop claimed first: adopt its id, never create.
      const current = await Timer.findById(timer._id);
      logId = current?.activityLogId || null;
      if (!logId) return null;
      timer.activityLogId = logId;
      return logId;
    }
  }

  // Idempotent write: only insert if the claimed document is not already there.
  const existing = await ActivityLog.findById(logId);
  if (existing) return logId;

  try {
    await ActivityLog.create({
      _id: logId,
      actor_id: timer.userId,
      action_type: TIME_LOGGED_ACTION,
      // sessionUuid satisfies the schema's UUID validation for entity_id.
      entity_id: timer.sessionUuid,
      metadata: {
        taskId: timer.taskId ? String(timer.taskId) : null,
        durationMs: timer.elapsedMs,
        startedAt: timer.sessionStartedAt,
        endedAt: timer.endedAt,
      },
      created_at: new Date(),
    });
  } catch (err) {
    // Lost the insert race on the _id primary key: the entry exists already.
    if (err && err.code !== DUPLICATE_KEY_CODE) throw err;
  }

  return logId;
}

async function start({ userId, taskId = null, hours, minutes, note = '' }) {
  assertObjectId(userId, 'userId');
  if (taskId) {
    assertObjectId(taskId, 'taskId');
    await assertTaskAssignedToStudent(taskId, userId);
  }
  const durationMs = validateHM(hours, minutes);

  const existing = await getActiveTimer(userId);
  if (existing) {
    if (existing.status === 'running' && existing.startedAt) {
      existing.elapsedMs += Date.now() - existing.startedAt.getTime();
    }
    existing.status = 'stopped';
    existing.startedAt = null;
    existing.pausedAt = null;
    existing.endedAt = new Date();
    await existing.save();
    // The superseded session is real worked time, so log it now rather than
    // leaving it for the stop() repair path, where it could later be mistaken
    // for the newer session's result.
    await ensureTimeLoggedEntry(existing);
  }

  const now = new Date();
  const timer = await Timer.create({
    userId,
    taskId: taskId || null,
    status: 'running',
    durationMs,
    startedAt: now,
    pausedAt: null,
    sessionStartedAt: now,
    endedAt: null,
    sessionUuid: uuidv4(),
    activityLogId: null,
    elapsedMs: 0,
    note,
  });

  return timer.summarize();
}

async function pause({ userId }) {
  assertObjectId(userId, 'userId');
  const timer = await getActiveTimer(userId);
  if (timer?.status !== 'running') {
    const e = new Error('Timer is not running');
    e.status = 409;
    throw e;
  }
  if (timer.startedAt) {
    timer.elapsedMs += Date.now() - timer.startedAt.getTime();
  }
  timer.status = 'paused';
  timer.startedAt = null;
  timer.pausedAt = new Date();
  await timer.save();
  return timer.summarize();
}

async function resume({ userId }) {
  assertObjectId(userId, 'userId');
  const timer = await getActiveTimer(userId);
  if (timer?.status !== 'paused') {
    const e = new Error('Timer is not paused');
    e.status = 409;
    throw e;
  }
  // Reaching or passing the countdown target no longer blocks resuming:
  // the student may keep working into overtime and that time is recorded.
  timer.status = 'running';
  timer.startedAt = new Date();
  timer.pausedAt = null;
  await timer.save();
  return timer.summarize();
}

async function stop({ userId }) {
  assertObjectId(userId, 'userId');
  const active = await getActiveTimer(userId);

  if (active) {
    // Re-verify ownership at stop time: a task unassigned mid-session must not
    // produce a log against this student.
    if (active.taskId) {
      await assertTaskAssignedToStudent(active.taskId, userId);
    }

    let finalElapsed = active.elapsedMs;
    if (active.status === 'running' && active.startedAt) {
      finalElapsed += Date.now() - active.startedAt.getTime();
    }

    // Atomically claim the stop. Only the first of two concurrent requests can
    // move the timer out of running/paused, so elapsed is written once and is
    // never double-accumulated. No clamp to durationMs: the persisted value is
    // the actual time worked, including overtime past the countdown target.
    const stopped = await Timer.findOneAndUpdate(
      { _id: active._id, status: { $in: ['running', 'paused'] } },
      {
        $set: {
          status: 'stopped',
          startedAt: null,
          pausedAt: null,
          endedAt: new Date(),
          elapsedMs: finalElapsed,
        },
      },
      { new: true },
    );

    // Lost the stop race: fall through to the already-stopped timer and make
    // sure its log exists, rather than stopping or logging it a second time.
    const timer = stopped || (await Timer.findById(active._id));
    const activityLogId = await ensureTimeLoggedEntry(timer);
    return { ...timer.summarize(), activityLogId, recovered: !stopped };
  }

  // No active timer. Repair only the genuine failure cases: the most recent
  // stopped session that either never claimed a log, or claimed one whose
  // document never landed. A fully logged session is not "recoverable" and
  // still reports 409, so an ordinary duplicate stop cannot resurrect it.
  const lastStopped = await Timer.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    status: 'stopped',
    sessionUuid: { $ne: null },
    elapsedMs: { $gt: 0 },
  }).sort({ updatedAt: -1 });

  if (lastStopped) {
    const logMissing =
      !lastStopped.activityLogId || !(await ActivityLog.findById(lastStopped.activityLogId));

    if (logMissing) {
      const activityLogId = await ensureTimeLoggedEntry(lastStopped);
      return { ...lastStopped.summarize(), activityLogId, recovered: true };
    }
  }

  const e = new Error('No active timer');
  e.status = 409;
  throw e;
}

async function status({ userId }) {
  assertObjectId(userId, 'userId');
  const timer = await getActiveTimer(userId);
  if (!timer) return { status: 'idle' };
  return timer.summarize();
}

async function reset({ userId }) {
  assertObjectId(userId, 'userId');
  const uid = new mongoose.Types.ObjectId(userId);
  // Reset deliberately discards the session, so every session-specific
  // identifier and timestamp is cleared. Dropping sessionUuid and elapsedMs is
  // what keeps a discarded session out of the stop() repair path, which would
  // otherwise log time the student explicitly threw away.
  await Timer.updateMany(
    { userId: uid, status: { $in: ['running', 'paused'] } },
    {
      $set: {
        status: 'stopped',
        startedAt: null,
        pausedAt: null,
        endedAt: null,
        sessionStartedAt: null,
        sessionUuid: null,
        activityLogId: null,
        elapsedMs: 0,
      },
    },
  );
  return { status: 'idle' };
}

async function history({ userId, page = 1, limit = 20 }) {
  assertObjectId(userId, 'userId');
  const uid = new mongoose.Types.ObjectId(userId);
  const skip = Math.max(0, (Number(page) - 1) * Number(limit));
  const [items, total] = await Promise.all([
    Timer.find({ userId: uid }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Timer.countDocuments({ userId: uid }),
  ]);
  return {
    page: Number(page),
    limit: Number(limit),
    total,
    items: items.map((t) => t.summarize()),
  };
}

async function stats({ userId, from, to }) {
  assertObjectId(userId, 'userId');
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const rows = await Timer.aggregate([
    { $match: match },
    {
      // elapsedMs is reported as actually worked; it is deliberately not
      // capped at durationMs so educator totals include overtime.
      $project: {
        createdAt: 1,
        elapsedMs: 1,
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } },
        totalMs: { $sum: '$elapsedMs' },
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
  assertObjectId(userId, 'userId');

  const timer = await getActiveTimer(userId);
  if (!timer) {
    const e = new Error('No active timer');
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
