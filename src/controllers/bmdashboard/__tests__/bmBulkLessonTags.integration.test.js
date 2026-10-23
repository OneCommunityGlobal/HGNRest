const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Lesson = require('../../../models/bmdashboard/buildingNewLesson');
const Batch = require('../../../models/bmdashboard/lessonTagBatch');
const factory = require('../bmBulkLessonTagController');

// This replica set is disposable and never reads the shared development database.
describe('bulk lesson tag transactions', () => {
  let replicaSet;
  let controller;
  let actorId;
  let lessons;
  const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
  const request = (body) => ({
    user: { requestorId: actorId, role: 'Volunteer' },
    body,
    params: {},
  });

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replicaSet.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await Promise.all([Lesson.init(), Batch.init()]);
    controller = factory(Lesson);
    actorId = String(new mongoose.Types.ObjectId());
  });
  beforeEach(async () => {
    await Promise.all([Lesson.deleteMany({}), Batch.deleteMany({})]);
    const common = {
      content: 'Test',
      author: actorId,
      relatedProject: new mongoose.Types.ObjectId(),
      allowedRoles: 'All',
    };
    lessons = await Lesson.create([
      { ...common, title: 'First lesson', tags: ['old'] },
      { ...common, title: 'Second lesson', tags: ['new'] },
    ]);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) await replicaSet.stop();
  });
  const applyRequest = () =>
    request({
      lessonIds: lessons.map((lesson) => String(lesson._id)),
      tags: ['new'],
      operation: 'add',
      expected: lessons.map((lesson) => ({ lessonId: String(lesson._id), tags: [...lesson.tags] })),
    });

  test('commits the batch and its audit record, then undoes only changed lessons', async () => {
    const res = response();
    await controller.apply(applyRequest(), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual(['old', 'new']);
    const batch = await Batch.findOne();
    expect(batch.changes).toHaveLength(1);
    const undoReq = request({});
    undoReq.params.batchId = String(batch._id);
    const undoRes = response();
    await controller.undo(undoReq, undoRes);
    expect(undoRes.json).toHaveBeenCalledWith({ message: 'Bulk tag change undone.' });
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual(['old']);
    expect((await Lesson.findById(lessons[1]._id).lean()).tags).toEqual(['new']);
    expect((await Batch.findById(batch._id)).undoneAt).toBeInstanceOf(Date);
  });

  test('rolls back lesson writes when saving the audit record fails', async () => {
    jest.spyOn(Batch, 'create').mockRejectedValue(new Error('Simulated audit failure'));
    const res = response();
    await controller.apply(applyRequest(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual(['old']);
    expect(await Batch.countDocuments()).toBe(0);
  });

  test('changes selected Tag Storage tags without touching unselected records', async () => {
    const storage = await Lesson.create({
      title: 'Tag Storage',
      content: 'Tag Storage Entry',
      tags: ['old'],
      author: '000000000000000000000000',
      relatedProject: '000000000000000000000000',
      allowedRoles: 'All',
    });
    const req = request({
      lessonIds: [String(storage._id)],
      tags: ['old'],
      operation: 'remove',
      expected: [{ lessonId: String(storage._id), tags: ['old'] }],
    });
    req.user.role = 'Administrator';
    const res = response();
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect((await Lesson.findById(storage._id).lean()).tags).toEqual([]);
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual(['old']);
    expect((await Lesson.findById(lessons[1]._id).lean()).tags).toEqual(['new']);
    expect(await Lesson.countDocuments()).toBe(3);
  });

  test('rejects undo without overwriting later edits', async () => {
    await controller.apply(applyRequest(), response());
    const batch = await Batch.findOne();
    await Lesson.updateOne({ _id: lessons[0]._id }, { $addToSet: { tags: 'later' } });
    const req = request({});
    req.params.batchId = String(batch._id);
    const res = response();
    await controller.undo(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual(['old', 'new', 'later']);
    expect((await Batch.findById(batch._id)).undoneAt).toBeUndefined();
  });
  test('rejects an entire mixed-ownership batch without writes or audit entries', async () => {
    await Lesson.updateOne(
      { _id: lessons[1]._id },
      { $set: { author: new mongoose.Types.ObjectId() } },
    );
    const res = response();
    await controller.apply(applyRequest(), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual(['old']);
    expect(await Batch.countDocuments()).toBe(0);
  });
  test('rechecks ownership after preview and rejects save when ownership changed', async () => {
    const req = applyRequest();
    const previewRes = response();
    await controller.preview(req, previewRes);
    expect(previewRes.json.mock.calls[0][0].changes).toHaveLength(2);
    await Lesson.updateOne(
      { _id: lessons[0]._id },
      { $set: { author: new mongoose.Types.ObjectId() } },
    );
    const res = response();
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual(['old']);
    expect(await Batch.countDocuments()).toBe(0);
  });
  test('undo rolls back all restores when a later lesson is no longer editable', async () => {
    const req = applyRequest();
    req.body.tags = ['old'];
    req.body.operation = 'remove';
    // Both records must change so the transaction can exercise a later denial.
    await Lesson.updateOne({ _id: lessons[1]._id }, { $set: { tags: ['old', 'new'] } });
    req.body.expected[1].tags = ['old', 'new'];
    await controller.apply(req, response());
    const batch = await Batch.findOne();
    await Lesson.updateOne(
      { _id: batch.changes[1].lessonId },
      { $set: { author: new mongoose.Types.ObjectId() } },
    );
    const undoReq = request({});
    undoReq.params.batchId = String(batch._id);
    const res = response();
    await controller.undo(undoReq, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((await Lesson.findById(lessons[0]._id).lean()).tags).toEqual([]);
    expect((await Lesson.findById(lessons[1]._id).lean()).tags).toEqual(['new']);
    expect((await Batch.findById(batch._id)).undoneAt).toBeUndefined();
  });
});
