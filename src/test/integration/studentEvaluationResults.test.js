// Jest's CommonJS VM cannot import the driver's OS adapter dynamically; use the same real module.
jest.mock('mongodb-memory-server-core/node_modules/mongodb/lib/runtime_adapters', () => ({
  ...jest.requireActual('mongodb-memory-server-core/node_modules/mongodb/lib/runtime_adapters'),
  resolveRuntimeAdapters: async (options) => ({ os: options.runtimeAdapters?.os ?? require('os') }),
}));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const UserProfile = require('../../models/userProfile');
const StudentEvaluation = require('../../models/studentEvaluation');
const EvaluationTask = require('../../models/evaluationTask');
const Notification = require('../../models/notification');
const {
  publishStudentEvaluationResults,
} = require('../../services/studentEvaluationResultsService');

// Use only a disposable replica set. Never load app startup or an environment-provided database URI.
describe('evaluation publication persistence', () => {
  let replicaSet;
  let studentId;
  let teacherId;
  let connected = false;
  const models = [UserProfile, StudentEvaluation, EvaluationTask, Notification];
  const essay = {
    taskName: 'Essay',
    type: 'assignment',
    weightage: 40,
    marks: 90,
    maxMarks: 100,
    percentage: 90,
    status: 'graded',
    feedback: 'Clear reasoning',
    dueDate: '2026-11-10T12:00:00.000Z',
    submissionDate: '2026-11-09T12:00:00.000Z',
  };
  const publish = (tasks, overrides = {}) =>
    publishStudentEvaluationResults({
      studentId: studentId.toString(),
      teacherId: teacherId.toString(),
      evaluations: [
        { category: 'Assignments', weightage: 40, marks: 90, maxMarks: 100, percentage: 90, tasks },
      ],
      ...overrides,
    });
  const readTasks = () => EvaluationTask.find({}).sort({ taskName: 1 }).lean();
  const snapshot = async () => ({
    evaluations: await StudentEvaluation.find({}).sort({ _id: 1 }).lean(),
    tasks: await readTasks(),
    student: await UserProfile.findById(studentId).lean(),
    notifications: await Notification.find({}).sort({ _id: 1 }).lean(),
  });

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0)
      throw new Error('Refusing to reuse an existing database connection');
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    // UserProfile declares conflicting email indexes; only evaluation indexes are needed here.
    UserProfile.schema.set('autoIndex', false);
    await mongoose.connect(replicaSet.getUri('evaluation_publication_test'), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true,
    });
    connected = true;
    await Promise.all(models.map((model) => model.init()));
  }, 120000);

  beforeEach(async () => {
    if (!connected) throw new Error('Isolated replica set was not initialized');
    await Promise.all(models.map((model) => model.deleteMany({})));
    const student = await UserProfile.create({
      firstName: 'Test',
      lastName: 'Student',
      email: 'student@example.test',
      password: 'FixturePassword123!',
      role: 'Volunteer',
      educationProfiles: { student: { lastEvaluationResultsViewedAt: null } },
    });
    const teacher = await UserProfile.create({
      firstName: 'Test',
      lastName: 'Teacher',
      email: 'teacher@example.test',
      password: 'FixturePassword123!',
      role: 'Teacher',
    });
    studentId = student._id;
    teacherId = teacher._id;
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    try {
      if (connected) await mongoose.disconnect();
    } finally {
      if (replicaSet) await replicaSet.stop();
    }
  });

  test('preserves persisted identities and omitted fields across replacement, nulls, zeroes and empty arrays', async () => {
    await publish([essay, { ...essay, taskName: 'Old task' }]);
    const original = (await readTasks()).find((task) => task.taskName === 'Essay');
    await publish([
      { taskName: '  eSsAy  ', feedback: 'Updated feedback' },
      { taskName: 'New task' },
    ]);
    let tasks = await readTasks();
    expect(tasks).toHaveLength(2);
    const retained = tasks.find((task) => task.taskName === 'eSsAy');
    expect(retained._id).toEqual(original._id);
    expect(retained).toMatchObject({
      weightage: 40,
      marks: 90,
      maxMarks: 100,
      percentage: 90,
      type: 'assignment',
      status: 'graded',
      feedback: 'Updated feedback',
      dueDate: new Date(essay.dueDate),
      submissionDate: new Date(essay.submissionDate),
    });
    expect(tasks.some((task) => task.taskName === 'Old task')).toBe(false);
    expect(tasks.find((task) => task.taskName === 'New task')._id).not.toEqual(original._id);

    await publish([
      {
        taskName: 'Essay',
        marks: 0,
        maxMarks: null,
        percentage: 0,
        weightage: 0,
        type: null,
        feedback: null,
        dueDate: null,
        submissionDate: null,
      },
    ]);
    tasks = await readTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      _id: original._id,
      marks: 0,
      maxMarks: null,
      percentage: 0,
      weightage: 0,
      type: null,
      feedback: null,
      dueDate: null,
      submissionDate: null,
      status: 'graded',
    });
    await publish([{ taskName: 'Essay' }]);
    expect((await readTasks())[0]).toMatchObject({
      _id: original._id,
      marks: 0,
      maxMarks: null,
      percentage: 0,
      type: null,
      feedback: null,
    });
    await publish([]);
    expect(await readTasks()).toEqual([]);
    expect(await StudentEvaluation.countDocuments({ studentId })).toBe(1);
    expect(await Notification.countDocuments({ recipient: studentId })).toBe(5);
  });

  test('rolls back actual category, task, feedback and viewing-state writes after a later failure', async () => {
    await publish([essay], { teacherFeedback: { overall: 'Original feedback' } });
    await UserProfile.updateOne(
      { _id: studentId },
      {
        $set: { 'educationProfiles.student.lastEvaluationResultsViewedAt': new Date('2026-11-01') },
      },
    );
    const before = await snapshot();
    // Fail after the real replacement and profile writes, while all are still in the transaction.
    const failure = new Error('Notification failure');
    jest.spyOn(Notification, 'create').mockRejectedValueOnce(failure);
    await expect(
      publish([{ taskName: 'Replacement', marks: 0 }], {
        evaluations: [{ category: 'Assignments', marks: 0, tasks: [{ taskName: 'Replacement' }] }],
        teacherFeedback: { overall: 'Must roll back' },
      }),
    ).rejects.toBe(failure);
    expect(await snapshot()).toEqual(before);
  });
});
