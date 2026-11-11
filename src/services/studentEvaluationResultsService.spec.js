jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../models/notification', () => ({
  find: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/studentEvaluation', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/evaluationTask', () => ({
  find: jest.fn(),
  deleteMany: jest.fn(),
  insertMany: jest.fn(),
}));

const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const Notification = require('../models/notification');
const StudentEvaluation = require('../models/studentEvaluation');
const EvaluationTask = require('../models/evaluationTask');
const service = require('./studentEvaluationResultsService');

const startSession = jest.spyOn(mongoose, 'startSession');
const mockSession = () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(),
  abortTransaction: jest.fn().mockResolvedValue(),
  endSession: jest.fn().mockResolvedValue(),
});

const validStudentId = '65cf6c3706d8ac105827bb2e';
const validTeacherId = '65cf6c3706d8ac105827bb2f';

describe('studentEvaluationResultsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    startSession.mockResolvedValue(mockSession());

    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: validStudentId,
          educationProfiles: {
            student: {
              lastEvaluationResultsViewedAt: null,
            },
          },
        }),
      }),
    });

    StudentEvaluation.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    Notification.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    UserProfile.findByIdAndUpdate.mockResolvedValue({});
    Notification.updateMany.mockResolvedValue({});
    Notification.create.mockResolvedValue({});
    StudentEvaluation.findOneAndUpdate.mockResolvedValue({ _id: validStudentId, category: 'Math' });
    EvaluationTask.deleteMany.mockResolvedValue({});
    EvaluationTask.insertMany.mockResolvedValue([]);
  });

  test('uses a sanitized ObjectId when querying student evaluations', async () => {
    await service.getStudentEvaluationResults(validStudentId);

    expect(StudentEvaluation.find).toHaveBeenCalledWith({
      studentId: expect.any(mongoose.Types.ObjectId),
    });
    expect(StudentEvaluation.find.mock.calls[0][0].studentId.toString()).toBe(validStudentId);
  });

  test('uses a sanitized ObjectId when querying notifications', async () => {
    await service.getEvaluationResultNotifications(validStudentId);

    expect(Notification.find).toHaveBeenCalledWith({
      recipient: expect.any(mongoose.Types.ObjectId),
      type: 'evaluation_results',
    });
    expect(Notification.find.mock.calls[0][0].recipient.toString()).toBe(validStudentId);
  });

  test('uses a sanitized ObjectId when marking notifications as viewed', async () => {
    await service.markEvaluationResultsViewed(validStudentId);

    expect(Notification.updateMany).toHaveBeenCalledWith(
      {
        recipient: expect.any(mongoose.Types.ObjectId),
        type: 'evaluation_results',
        isRead: false,
      },
      {
        $set: { isRead: true },
      },
    );
    expect(Notification.updateMany.mock.calls[0][0].recipient.toString()).toBe(validStudentId);
  });

  test('uses sanitized ObjectIds when publishing evaluation results', async () => {
    await service.publishStudentEvaluationResults({
      studentId: validStudentId,
      teacherId: validTeacherId,
      evaluations: [
        {
          category: 'Math',
          weightage: 100,
          totalItems: 5,
          completedItems: 5,
          marks: 90,
          percentage: 90,
          performanceLevel: 'Excellent',
          feedback: 'Strong work',
          tasks: [],
        },
      ],
    });

    expect(StudentEvaluation.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: expect.any(mongoose.Types.ObjectId),
        category: 'Math',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          publishedBy: expect.any(mongoose.Types.ObjectId),
        }),
      }),
      expect.any(Object),
    );
    expect(StudentEvaluation.findOneAndUpdate.mock.calls[0][0].studentId.toString()).toBe(
      validStudentId,
    );
    expect(StudentEvaluation.findOneAndUpdate.mock.calls[0][1].$set.publishedBy.toString()).toBe(
      validTeacherId,
    );
  });
});

// All queries in these response-contract tests are mocked; no database is used.
// Cover populated, empty, and legacy records without equating unknown values with zero.
describe('evaluation results response contract', () => {
  const query = (value) => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });
  const category = (overrides = {}) => ({
    _id: 'category-1',
    category: 'Assignments',
    weightage: 100,
    totalItems: 1,
    completedItems: 1,
    marks: 8,
    maxMarks: 10,
    percentage: 80,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });
  const task = (overrides = {}) => ({
    _id: 'task-1',
    evaluationId: 'category-1',
    taskName: 'Essay',
    marks: 8,
    maxMarks: 10,
    percentage: 80,
    type: 'Essay',
    status: 'graded',
    feedback: 'Clear explanation',
    submissionDate: new Date('2026-01-01'),
    dueDate: new Date('2026-01-02'),
    ...overrides,
  });
  beforeEach(() => {
    jest.resetAllMocks();
    UserProfile.findById.mockReturnValue(query({ educationProfiles: { student: {} } }));
    StudentEvaluation.find.mockReturnValue(query([]));
    EvaluationTask.find.mockReturnValue(query([]));
  });

  test('returns a weighted score, marks, task details and authored general feedback', async () => {
    const updatedAt = new Date('2026-01-03');
    UserProfile.findById
      .mockReturnValueOnce(
        query({
          educationProfiles: {
            student: {
              evaluationFeedback: {
                authorId: validTeacherId,
                overall: 'Steady progress',
                strengths: ['Analysis'],
                improvements: ['Proofreading'],
                teacherTitle: 'Teacher',
                updatedAt,
              },
            },
          },
        }),
      )
      .mockReturnValueOnce(query({ firstName: 'Test', lastName: 'Teacher' }));
    StudentEvaluation.find.mockReturnValue(
      query([
        category({ weightage: 75 }),
        category({ _id: 'category-2', category: 'Quiz', weightage: 25, marks: 5, percentage: 50 }),
      ]),
    );
    EvaluationTask.find.mockReturnValue(
      query([
        task(),
        task({
          _id: 'task-2',
          evaluationId: 'category-2',
          percentage: 50,
          submissionDate: new Date('2026-01-03'),
        }),
      ]),
    );
    const result = await service.getStudentEvaluationResults(validStudentId);
    expect(result.summary).toMatchObject({
      overallScore: 72.5,
      averageScore: 65,
      earnedMarks: 13,
      maxMarks: 20,
      totalCategories: 2,
      totalTasks: 2,
      completedTasks: 2,
      onTimeSubmissions: 1,
      lateSubmissions: 1,
    });
    expect(result.categories[0]).toMatchObject({ marks: 8, maxMarks: 10, percentage: 80 });
    expect(result.taskResults[0]).toMatchObject({
      taskId: 'task-1',
      type: 'Essay',
      marks: 8,
      maxMarks: 10,
      feedback: 'Clear explanation',
      submissionStatus: 'on_time',
    });
    expect(result.categories[0].tasks[0]).toEqual(
      expect.objectContaining({ type: 'Essay', maxMarks: 10 }),
    );
    expect(result.teacherFeedback).toEqual({
      teacherName: 'Test Teacher',
      teacherTitle: 'Teacher',
      overall: 'Steady progress',
      strengths: ['Analysis'],
      improvements: ['Proofreading'],
      updatedAt,
    });
    expect(UserProfile.findById).toHaveBeenLastCalledWith(validTeacherId);
  });

  test('returns empty collections and unavailable scores for no evaluations', async () => {
    const result = await service.getStudentEvaluationResults(validStudentId);
    expect(result).toEqual({
      summary: {
        overallScore: null,
        averageScore: null,
        earnedMarks: null,
        maxMarks: null,
        totalCategories: 0,
        totalTasks: 0,
        completedTasks: 0,
        onTimeSubmissions: 0,
        lateSubmissions: 0,
        performanceLevel: null,
        performanceColor: null,
        lastPublishedAt: null,
      },
      categories: [],
      taskResults: [],
      teacherFeedback: {
        teacherName: null,
        teacherTitle: null,
        overall: null,
        strengths: [],
        improvements: [],
        updatedAt: null,
      },
    });
    expect(EvaluationTask.find).not.toHaveBeenCalled();
  });

  test('does not fabricate missing scores, marks, maxima, task types or feedback', async () => {
    StudentEvaluation.find.mockReturnValue(
      query([category({ marks: undefined, maxMarks: undefined, percentage: null })]),
    );
    EvaluationTask.find.mockReturnValue(
      query([task({ marks: null, maxMarks: undefined, percentage: undefined, type: undefined })]),
    );
    const result = await service.getStudentEvaluationResults(validStudentId);
    expect(result.summary).toMatchObject({
      overallScore: null,
      averageScore: null,
      earnedMarks: null,
      maxMarks: null,
      performanceLevel: null,
      performanceColor: null,
    });
    expect(result.categories[0]).toMatchObject({ marks: null, maxMarks: null, percentage: null });
    expect(result.taskResults[0]).toMatchObject({
      marks: null,
      maxMarks: null,
      percentage: null,
      type: null,
      performanceColor: null,
    });
    expect(result.teacherFeedback.strengths).toEqual([]);
  });

  test('preserves zero marks and scores and uses the existing zero-weight fallback', async () => {
    StudentEvaluation.find.mockReturnValue(
      query([category({ weightage: 0, marks: 0, maxMarks: 0, percentage: 0 })]),
    );
    EvaluationTask.find.mockReturnValue(query([task({ marks: 0, maxMarks: 0, percentage: 0 })]));
    const result = await service.getStudentEvaluationResults(validStudentId);
    expect(result.summary).toMatchObject({
      overallScore: 0,
      averageScore: 0,
      earnedMarks: 0,
      maxMarks: 0,
    });
    expect(result.taskResults[0]).toMatchObject({ marks: 0, maxMarks: 0, percentage: 0 });
  });

  test('uses known task scores for the average without inventing missing maximum marks', async () => {
    StudentEvaluation.find.mockReturnValue(query([category({ maxMarks: null })]));
    EvaluationTask.find.mockReturnValue(
      query([task({ percentage: 0 }), task({ percentage: null })]),
    );
    const result = await service.getStudentEvaluationResults(validStudentId);
    expect(result.summary).toMatchObject({
      overallScore: 80,
      averageScore: 0,
      earnedMarks: null,
      maxMarks: null,
    });
  });

  test('does not penalize an ungraded zero-weight category', async () => {
    StudentEvaluation.find.mockReturnValue(
      query([category(), category({ _id: 'category-2', weightage: 0, percentage: null })]),
    );
    const result = await service.getStudentEvaluationResults(validStudentId);
    expect(result.summary.overallScore).toBe(80);
    expect(result.taskResults).toEqual([]);
    expect(result.categories.every((item) => item.tasks.length === 0)).toBe(true);
  });

  test('does not assume a missing weight is zero', async () => {
    StudentEvaluation.find.mockReturnValue(query([category({ weightage: undefined })]));
    expect(
      (await service.getStudentEvaluationResults(validStudentId)).summary.overallScore,
    ).toBeNull();
  });

  test.each([undefined, null, -1, '25', NaN, Infinity])(
    'returns null for unavailable or invalid weight %p, even alongside zero weights',
    async (weightage) => {
      StudentEvaluation.find.mockReturnValue(
        query([category({ weightage }), category({ _id: 'category-2', weightage: 0 })]),
      );
      const { summary } = await service.getStudentEvaluationResults(validStudentId);
      expect(summary).toMatchObject({
        overallScore: null,
        performanceLevel: null,
        performanceColor: null,
      });
    },
  );

  test.each(
    [undefined, null, -1, 101, '80', NaN, Infinity].flatMap((percentage) =>
      [100, 0].map((weightage) => [percentage, weightage]),
    ),
  )(
    'returns null for required invalid percentage %p with weight %p',
    async (percentage, weightage) => {
      StudentEvaluation.find.mockReturnValue(query([category({ percentage, weightage })]));
      const { summary } = await service.getStudentEvaluationResults(validStudentId);
      expect(summary.overallScore).toBeNull();
    },
  );

  test.each([null, -1, 101, '80', NaN, Infinity])(
    'excludes zero-weight percentage %p from weighted arithmetic',
    async (percentage) => {
      StudentEvaluation.find.mockReturnValue(
        query([category(), category({ _id: 'category-2', weightage: 0, percentage })]),
      );
      expect((await service.getStudentEvaluationResults(validStudentId)).summary.overallScore).toBe(
        80,
      );
    },
  );

  test.each([
    [1, 2, 66.67],
    [0, 0, 50],
  ])('rounds scores with weights %p and %p', async (firstWeight, secondWeight, expected) => {
    StudentEvaluation.find.mockReturnValue(
      query([
        category({ weightage: firstWeight, percentage: 0 }),
        category({ _id: 'category-2', weightage: secondWeight, percentage: 100 }),
      ]),
    );
    expect((await service.getStudentEvaluationResults(validStudentId)).summary.overallScore).toBe(
      expected,
    );
  });

  test('keeps feedback when its author no longer exists', async () => {
    UserProfile.findById
      .mockReturnValueOnce(
        query({
          educationProfiles: {
            student: {
              evaluationFeedback: { authorId: validTeacherId, overall: 'Recorded feedback' },
            },
          },
        }),
      )
      .mockReturnValueOnce(query(null));
    const result = await service.getStudentEvaluationResults(validStudentId);
    expect(result.teacherFeedback).toMatchObject({
      teacherName: null,
      overall: 'Recorded feedback',
      strengths: [],
      improvements: [],
    });
  });
});

describe('atomic evaluation publishing', () => {
  let session;
  const payload = () => ({
    studentId: validStudentId,
    teacherId: validTeacherId,
    message: '<b>Published</b><script>alert(1)</script>',
    evaluations: [
      {
        category: ' Math ',
        weightage: 0,
        marks: 0,
        maxMarks: 10,
        percentage: 0,
        totalItems: 1,
        completedItems: 1,
        tasks: [
          {
            taskName: ' Essay ',
            type: 'Essay',
            marks: 0,
            maxMarks: 10,
            percentage: 0,
            weightage: 0,
            status: 'graded',
            dueDate: '2026-01-02',
            submissionDate: '2026-01-01',
          },
        ],
      },
    ],
    teacherFeedback: {
      overall: 'Good effort',
      strengths: ['Reasoning'],
      improvements: ['Practice'],
      teacherTitle: 'Teacher',
    },
  });
  beforeEach(() => {
    jest.resetAllMocks();
    session = mockSession();
    startSession.mockResolvedValue(session);
    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ educationProfiles: { student: {} } }),
      }),
    });
    UserProfile.findByIdAndUpdate.mockResolvedValue({});
    StudentEvaluation.findOneAndUpdate.mockResolvedValue({ _id: 'evaluation-1', category: 'Math' });
    EvaluationTask.deleteMany.mockResolvedValue({});
    EvaluationTask.insertMany.mockResolvedValue([]);
    Notification.create.mockResolvedValue([]);
  });

  test('persists nullable fields, genuine zero values, feedback and sanitized notification in one session', async () => {
    const before = new Date();
    await service.publishStudentEvaluationResults(payload());
    expect(StudentEvaluation.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Math' }),
      { $set: expect.objectContaining({ maxMarks: 10, marks: 0, weightage: 0, percentage: 0 }) },
      expect.objectContaining({ session, runValidators: true }),
    );
    expect(EvaluationTask.deleteMany).toHaveBeenCalledWith(
      { evaluationId: 'evaluation-1' },
      { session },
    );
    expect(EvaluationTask.insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          taskName: 'Essay',
          type: 'Essay',
          marks: 0,
          maxMarks: 10,
          weightage: 0,
          percentage: 0,
          dueDate: new Date('2026-01-02'),
        }),
      ],
      { session },
    );
    const updates = UserProfile.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(updates['educationProfiles.student.lastEvaluationResultsViewedAt']).toBeNull();
    const feedback = updates['educationProfiles.student.evaluationFeedback'];
    expect(feedback).toMatchObject(payload().teacherFeedback);
    expect(feedback.authorId.toString()).toBe(validTeacherId);
    expect(feedback.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(UserProfile.findByIdAndUpdate.mock.calls[0][2]).toMatchObject({ session });
    expect(Notification.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          message: '<b>Published</b>',
          type: 'evaluation_results',
          metadata: { categories: ['Math'] },
        }),
      ],
      { session },
    );
    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('does not invent omitted grades or overwrite omitted general feedback', async () => {
    await service.publishStudentEvaluationResults({
      studentId: validStudentId,
      teacherId: validTeacherId,
      evaluations: [{ category: 'Math', tasks: [{ taskName: 'Ungraded' }] }],
    });
    expect(StudentEvaluation.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({
      marks: null,
      maxMarks: null,
      percentage: null,
      weightage: null,
    });
    expect(EvaluationTask.insertMany.mock.calls[0][0][0]).toMatchObject({
      marks: null,
      maxMarks: null,
      percentage: null,
      type: null,
      status: 'pending',
    });
    expect(UserProfile.findByIdAndUpdate.mock.calls[0][1].$set).not.toHaveProperty(
      'educationProfiles.student.evaluationFeedback',
    );
  });

  test.each([
    [
      'student ID',
      (p) => {
        p.studentId = 'invalid';
      },
    ],
    [
      'teacher ID',
      (p) => {
        p.teacherId = 'invalid';
      },
    ],
    [
      'null category',
      (p) => {
        p.evaluations.push(null);
      },
    ],
    [
      'blank category',
      (p) => {
        p.evaluations[0].category = ' ';
      },
    ],
    [
      'duplicate category',
      (p) => {
        p.evaluations.push({ category: 'math', tasks: [] });
      },
    ],
    [
      'invalid task',
      (p) => {
        p.evaluations[0].tasks.push('bad');
      },
    ],
    [
      'duplicate task',
      (p) => {
        p.evaluations[0].tasks.push({ taskName: 'essay' });
      },
    ],
    [
      'negative marks',
      (p) => {
        p.evaluations[0].marks = -1;
      },
    ],
    [
      'infinite weight',
      (p) => {
        p.evaluations[0].weightage = Infinity;
      },
    ],
    [
      'string percentage',
      (p) => {
        p.evaluations[0].percentage = '80';
      },
    ],
    [
      'high task percentage',
      (p) => {
        p.evaluations[0].tasks[0].percentage = 101;
      },
    ],
    [
      'invalid maximum',
      (p) => {
        p.evaluations[0].tasks[0].maxMarks = -1;
      },
    ],
    [
      'invalid status',
      (p) => {
        p.evaluations[0].tasks[0].status = 'unknown';
      },
    ],
    [
      'invalid date',
      (p) => {
        p.evaluations[0].tasks[0].dueDate = '2026-02-30';
      },
    ],
    [
      'feedback list',
      (p) => {
        p.teacherFeedback.strengths = 'bad';
      },
    ],
    [
      'spoofed author',
      (p) => {
        p.teacherFeedback.authorId = validStudentId;
      },
    ],
    [
      'empty sanitized message',
      (p) => {
        p.message = '<script>bad</script>';
      },
    ],
  ])('rejects %s before any writes', async (name, mutate) => {
    const input = payload();
    mutate(input);
    await expect(service.publishStudentEvaluationResults(input)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(startSession).not.toHaveBeenCalled();
    expect(StudentEvaluation.findOneAndUpdate).not.toHaveBeenCalled();
    expect(EvaluationTask.deleteMany).not.toHaveBeenCalled();
    expect(UserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test.each(['category', 'delete', 'insert', 'profile', 'notification'])(
    'aborts and closes the session on %s failure without committing',
    async (stage) => {
      const operation = {
        category: StudentEvaluation.findOneAndUpdate,
        delete: EvaluationTask.deleteMany,
        insert: EvaluationTask.insertMany,
        profile: UserProfile.findByIdAndUpdate,
        notification: Notification.create,
      }[stage];
      operation.mockRejectedValueOnce(new Error('Write failed'));
      await expect(service.publishStudentEvaluationResults(payload())).rejects.toThrow(
        'Write failed',
      );
      expect(session.abortTransaction).toHaveBeenCalledTimes(1);
      expect(session.commitTransaction).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
      if (stage !== 'notification') expect(Notification.create).not.toHaveBeenCalled();
    },
  );

  test('awaits task insertion before starting the next category', async () => {
    const input = payload();
    input.evaluations.push({ category: 'Science', tasks: [] });
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    let reached;
    const inserted = new Promise((resolve) => {
      reached = resolve;
    });
    EvaluationTask.insertMany.mockImplementationOnce(() => {
      reached();
      return waiting;
    });
    const publication = service.publishStudentEvaluationResults(input);
    await inserted;
    expect(StudentEvaluation.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(Notification.create).not.toHaveBeenCalled();
    release([]);
    await publication;
    expect(StudentEvaluation.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
