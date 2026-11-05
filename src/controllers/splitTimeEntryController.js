const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const Task = require('../models/task');
const WBS = require('../models/wbs');
const Project = require('../models/project');
const Batch = require('../models/timeEntryBatch');
const Timer = require('../models/timer');
const logger = require('../startup/logger');
const {
  splitReceiptId,
  normalizeSplitTimeEntry,
  SplitTimeEntryError,
} = require('../utilities/splitTimeEntryValidation');

function existingReceipt(receipt, input) {
  if (receipt.fingerprint !== input.fingerprint) {
    throw new SplitTimeEntryError(
      'This session was already saved with different allocations. Retry the original split.',
      409,
    );
  }
  return {
    entryIds: receipt.entryIds,
    allocations: receipt.allocations,
    totalMinutes: receipt.totalMinutes,
    dateOfWork: receipt.dateOfWork,
    batchId: input.batchId,
  };
}

async function claimTimer(input, session) {
  const timer = await Timer.findOne({
    userId: input.personId,
    loggingSessionId: input.batchId,
    started: true,
  }).session(session);
  if (!timer)
    throw new SplitTimeEntryError(
      'This timer session is no longer active. Refresh the timer before logging time.',
      409,
    );
  const elapsed = timer.paused ? 0 : Math.max(0, Date.now() - new Date(timer.startAt).getTime());
  const availableMinutes = Math.floor((timer.goal - timer.time + elapsed) / 60000);
  if (!Number.isFinite(availableMinutes) || input.totalMinutes > availableMinutes) {
    throw new SplitTimeEntryError(
      'The split exceeds the recorded timer time. Refresh the timer and try again.',
    );
  }
  await Timer.updateOne(
    { _id: timer._id },
    { $set: { splitBatchId: input.receiptId } },
    { session },
  );
}

async function saveAllocation(input, row, context, dependencies) {
  const { profile, session, emails } = context;
  const { TimeEntry, notifyTaskOvertimeEmailBody } = dependencies;
  const task = await Task.findOne({
    _id: row.taskId,
    isActive: true,
    deleted: { $ne: true },
    'resources.userID': input.personId,
  }).session(session);
  if (!task)
    throw new SplitTimeEntryError(
      'One of the tasks is no longer assigned to you or is inactive.',
      403,
    );
  const wbs = await WBS.findById(task.wbsId).session(session);
  const project = wbs && (await Project.findById(wbs.projectId).session(session));
  if (
    !wbs?.isActive ||
    !project?.isActive ||
    !profile.projects.some((id) => String(id) === String(project._id))
  ) {
    throw new SplitTimeEntryError('Every task must belong to one of your active projects.', 403);
  }
  const now = new Date();
  const entry = new TimeEntry({
    personId: input.personId,
    splitBatchId: input.receiptId,
    projectId: project._id,
    wbsId: wbs._id,
    taskId: task._id,
    dateOfWork: input.dateOfWork,
    totalSeconds: row.minutes * 60,
    notes: row.notes,
    isTangible: true,
    entryType: 'default',
    createdDateTime: now,
    lastModifiedDateTime: now,
  });
  await entry.save({ session });
  const updatedTask = await Task.findOneAndUpdate(
    { _id: row.taskId },
    { $inc: { hoursLogged: row.minutes / 60 } },
    { new: true, session },
  );
  if (updatedTask.hoursLogged > updatedTask.estimatedHours)
    emails.push(() => notifyTaskOvertimeEmailBody(profile, updatedTask));
  const category = String(project.category).toLowerCase();
  const categoryKey = [
    'housing',
    'food',
    'education',
    'society',
    'energy',
    'economics',
    'stewardship',
  ].includes(category)
    ? category
    : 'unassigned';
  profile.hoursByCategory[categoryKey] += row.minutes / 60;

  return entry._id;
}

async function saveBatch(input, session, dependencies) {
  const { TimeEntry } = dependencies;
  const receipt = await Batch.findById(input.receiptId).session(session);
  if (receipt) return { result: existingReceipt(receipt, input), emails: [], replayed: true };
  const emails = [];
  await claimTimer(input, session);
  const profile = await UserProfile.findById(input.personId).session(session);
  if (!profile || !profile.isActive)
    throw new SplitTimeEntryError('An active user account is required.', 403);
  const firstEntry = !(await TimeEntry.findOne({ personId: input.personId }).session(session));
  const entryIds = [];
  // Session operations must run sequentially inside a MongoDB transaction.
  for (const row of input.allocations) {
    entryIds.push(await saveAllocation(input, row, { profile, session, emails }, dependencies));
  }
  profile.totalTangibleHrs += input.totalMinutes / 60;
  if (firstEntry) {
    profile.isFirstTimelog = false;
    profile.startDate = new Date();
  }
  profile.lastActivityAt = new Date();
  await profile.save({ session, validateModifiedOnly: true });
  const receiptData = {
    _id: input.receiptId,
    personId: input.personId,
    fingerprint: input.fingerprint,
    totalMinutes: input.totalMinutes,
    dateOfWork: input.dateOfWork,
    entryIds,
    allocations: input.allocations,
  };
  await new Batch(receiptData).save({ session });
  return { result: existingReceipt(receiptData, input), emails, replayed: false };
}

async function afterCommit(input, outcome, dependencies) {
  if (outcome.replayed) return;
  try {
    dependencies.removeOutdatedUserprofileCache(input.personId);
    for (let week = 0; week < 4; week += 1) dependencies.invalidateWeeklySummariesCache(week);
  } catch {
    logger.logException(new Error('Could not invalidate caches after split save'));
  }
  await Promise.allSettled(outcome.emails.map((send) => Promise.resolve().then(send)));
}

async function transactionFailure(error, input) {
  // A concurrent request may have committed this receipt while ours failed.
  if (error.code === 11000 && input) {
    try {
      const receipt = await Batch.findById(input.receiptId);
      if (receipt)
        return { status: 200, body: { ...existingReceipt(receipt, input), replayed: true } };
    } catch (conflict) {
      if (conflict instanceof SplitTimeEntryError)
        return { status: conflict.status, body: { error: conflict.message } };
    }
  }
  if (error instanceof SplitTimeEntryError)
    return { status: error.status, body: { error: error.message } };
  logger.logException(new Error('Split time-entry transaction failed'));
  return {
    status: 503,
    body: {
      error: 'Could not confirm the split save. Your allocations are kept; retry the same split.',
    },
  };
}

module.exports = function createSplitTimeEntryController(dependencies) {
  const postSplitTimeEntries = async function (req, res) {
    let session;
    let input;
    let outcome;
    try {
      input = normalizeSplitTimeEntry(req.body || {}, req.user?.requestorId);
      // Older replica sets cannot create a new collection inside a transaction.
      try {
        await Batch.createCollection();
      } catch (error) {
        if (error.code !== 48) throw error;
      }
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        // withTransaction can rerun the callback after a write conflict.
        outcome = await saveBatch(input, session, dependencies);
      });
      await afterCommit(input, outcome, dependencies);
      return res.status(200).send({ ...outcome.result, replayed: outcome.replayed });
    } catch (error) {
      const response = await transactionFailure(error, input);
      return res.status(response.status).send(response.body);
    } finally {
      if (session) {
        try {
          await session.endSession();
        } catch {
          logger.logException(new Error('Could not close split time-entry session'));
        }
      }
    }
  };

  const getSplitTimeEntryReceipt = async (req, res) => {
    try {
      // Reuse the strict identity/key validation without trusting a body-supplied identity.
      const input = {
        batchId: req.params.batchId,
        receiptId: splitReceiptId(req.user?.requestorId, req.params.batchId),
      };
      const receipt = await Batch.findById(input.receiptId);
      if (!receipt)
        return res.status(404).send({ error: 'This split has not been confirmed yet.' });
      return res.status(200).send({
        batchId: input.batchId,
        dateOfWork: receipt.dateOfWork,
        totalMinutes: receipt.totalMinutes,
        entryIds: receipt.entryIds,
        allocations: receipt.allocations,
        replayed: true,
      });
    } catch (error) {
      if (error instanceof SplitTimeEntryError)
        return res.status(error.status).send({ error: error.message });
      return res.status(503).send({ error: 'Could not check the saved split. Please retry.' });
    }
  };
  return { postSplitTimeEntries, getSplitTimeEntryReceipt };
};
