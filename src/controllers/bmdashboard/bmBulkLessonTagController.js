const mongoose = require('mongoose');
const LessonTagBatch = require('../../models/bmdashboard/lessonTagBatch');
const logger = require('../../startup/logger');

const MAX_LESSONS = 100;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 10;
const HISTORY_LIMIT = 25;
const CONFLICT = 409;
const sameTags = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fail = (status, message) => Object.assign(new Error(message), { status });
const privileged = (actor) => ['Owner', 'Administrator', 'Admin'].includes(actor.role);
const canEditLesson = (lesson, actor) =>
  privileged(actor) || String(lesson.author) === String(actor.requestorId);

const assertCanUndoLesson = (lesson, actor) => {
  if (lesson && !canEditLesson(lesson, actor)) {
    throw fail(
      403,
      'You no longer have permission to edit a lesson in this batch. Undo was cancelled.',
    );
  }
};

const respond = (res, error) => {
  if (!error.status) logger.logException(error, 'bulkLessonTags');
  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'Bulk tag update failed. No changes were saved.',
  });
};

const actorFor = (req) => {
  // Identity comes from the existing JWT middleware, never from client input.
  if (!req.user?.requestorId) throw fail(401, 'Please sign in.');
  return req.user;
};

const planFor = async (Lesson, body, session, actor) => {
  const { lessonIds, operation, tags } = body;
  if (
    !['add', 'remove'].includes(operation) ||
    !Array.isArray(lessonIds) ||
    !lessonIds.length ||
    lessonIds.length > MAX_LESSONS ||
    lessonIds.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) ||
    new Set(lessonIds).size !== lessonIds.length ||
    !Array.isArray(tags) ||
    !tags.length ||
    tags.length > MAX_TAGS ||
    tags.some(
      (tag) =>
        typeof tag !== 'string' || !tag.trim() || tag !== tag.trim() || tag.length > MAX_TAG_LENGTH,
    ) ||
    new Set(tags).size !== tags.length
  ) {
    throw fail(
      400,
      'Choose 1–100 lessons and 1–20 unique existing tags (up to 10 characters each).',
    );
  }
  const lessons = await Lesson.find({ _id: { $in: lessonIds } })
    .session(session)
    .lean();
  if (lessons.length !== lessonIds.length)
    throw fail(CONFLICT, 'A selected lesson was deleted. Refresh the list.');
  if (lessons.some((lesson) => !canEditLesson(lesson, actor))) {
    throw fail(
      403,
      'You can edit only your own lessons unless you are an Admin or Owner. No changes were saved.',
    );
  }
  const existing = await Lesson.distinct('tags').session(session);
  if (tags.some((tag) => !existing.includes(tag)))
    throw fail(CONFLICT, 'A selected tag no longer exists. Refresh the list.');
  return lessons.map((lesson) => {
    const before = lesson.tags || [];
    const after =
      operation === 'add'
        ? [...new Set([...before, ...tags])]
        : before.filter((tag) => !tags.includes(tag));
    return { lessonId: lesson._id, title: lesson.title, before, after };
  });
};

const history = async (req, res) => {
  try {
    const actor = actorFor(req);
    // Users can inspect their batches; administrators can inspect all batches.
    const filter = privileged(actor) ? {} : { actor: actor.requestorId };
    const entries = await LessonTagBatch.find(filter)
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();
    return res.json(entries);
  } catch (error) {
    return respond(res, error);
  }
};

const preview = async (Lesson, req, res) => {
  try {
    const actor = actorFor(req);
    return res.json({ changes: await planFor(Lesson, req.body, null, actor) });
  } catch (error) {
    return respond(res, error);
  }
};

module.exports = (Lesson) => {
  const apply = async (req, res) => {
    let session;
    try {
      const actor = actorFor(req);
      session = await mongoose.startSession();
      let batch;
      await session.withTransaction(async () => {
        const changes = await planFor(Lesson, req.body, session, actor);
        const { expected } = req.body;
        // Recheck the preview inside the transaction to reject stale confirmations.
        if (
          !Array.isArray(expected) ||
          expected.length !== changes.length ||
          new Set(expected.map((entry) => entry?.lessonId)).size !== changes.length ||
          changes.some(
            (change) =>
              !expected.some(
                (entry) =>
                  entry &&
                  entry.lessonId === String(change.lessonId) &&
                  sameTags(entry.tags, change.before),
              ),
          )
        ) {
          throw fail(
            CONFLICT,
            'Lesson tags changed since preview. Review a new preview before applying.',
          );
        }
        const actual = changes.filter((change) => !sameTags(change.before, change.after));
        if (!actual.length)
          throw fail(400, 'These lessons already have the requested tags. Nothing changed.');
        // MongoDB sessions require sequential operations inside a transaction.
        // eslint-disable-next-line no-restricted-syntax
        for (const change of actual) {
          // eslint-disable-next-line no-await-in-loop
          await Lesson.updateOne(
            { _id: change.lessonId },
            { $set: { tags: change.after } },
            { session },
          );
        }
        [batch] = await LessonTagBatch.create(
          [
            {
              actor: actor.requestorId,
              operation: req.body.operation,
              tags: req.body.tags,
              changes: actual,
            },
          ],
          { session },
        );
      });
      return res.status(201).json(batch);
    } catch (error) {
      return respond(res, error);
    } finally {
      if (session) await session.endSession();
    }
  };

  const undo = async (req, res) => {
    let session;
    try {
      const actor = actorFor(req);
      if (!/^[a-f\d]{24}$/i.test(req.params.batchId)) throw fail(400, 'Invalid batch ID.');
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const batch = await LessonTagBatch.findById(req.params.batchId).session(session);
        if (!batch) throw fail(404, 'Batch not found.');
        if (String(batch.actor) !== actor.requestorId && !privileged(actor))
          throw fail(403, 'You cannot undo this batch.');
        if (batch.undoneAt) throw fail(CONFLICT, 'This batch was already undone.');
        // Keep reads and writes sequential in the same MongoDB transaction.
        // eslint-disable-next-line no-restricted-syntax
        for (const change of batch.changes) {
          // eslint-disable-next-line no-await-in-loop
          const lesson = await Lesson.findById(change.lessonId).session(session).lean();
          assertCanUndoLesson(lesson, actor);
          if (!lesson || !sameTags(lesson.tags || [], change.after)) {
            throw fail(
              CONFLICT,
              'A lesson was deleted or its tags changed after this batch. Undo was cancelled to preserve newer edits.',
            );
          }
          // eslint-disable-next-line no-await-in-loop
          await Lesson.updateOne(
            { _id: change.lessonId },
            { $set: { tags: change.before } },
            { session },
          );
        }
        batch.undoneAt = new Date();
        batch.undoneBy = actor.requestorId;
        await batch.save({ session });
      });
      return res.json({ message: 'Bulk tag change undone.' });
    } catch (error) {
      return respond(res, error);
    } finally {
      if (session) await session.endSession();
    }
  };
  return { preview: (req, res) => preview(Lesson, req, res), apply, history, undo };
};
