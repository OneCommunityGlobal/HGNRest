/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

jest.mock('../../models/lessonPlanDraft', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

/* =======================
   IMPORTS AFTER MOCKS
   ======================= */

const LessonPlanDraft = require('../../models/lessonPlanDraft');
const { hasPermission } = require('../../utilities/permissions');
const controller = require('../lessonPlanDraftController');

/* =======================
   TEST HELPERS
   ======================= */

const makeChain = (result) => {
  const promise = Promise.resolve(result);
  promise.sort = jest.fn(() => promise);
  return promise;
};

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const studentRequestor = { requestorId: 'student-1', role: 'student' };
const educatorRequestor = { requestorId: 'educator-1', role: 'Educator' };

beforeEach(() => {
  jest.clearAllMocks();
});

/* =======================
   POST /student/lesson-plan-drafts
   ======================= */

describe('createLessonPlanDraft', () => {
  test('returns 201 and the created draft on success', async () => {
    LessonPlanDraft.create.mockResolvedValue({
      _id: 'draft-1',
      studentId: 'student-1',
      goals: ['Learn fractions'],
      topics: ['Math'],
      suggestedTasks: [],
      status: 'draft',
    });

    const req = {
      body: {
        requestor: studentRequestor,
        goals: ['Learn fractions'],
        topics: ['Math'],
      },
    };
    const res = mockRes();

    await controller.createLessonPlanDraft(req, res);

    expect(LessonPlanDraft.create).toHaveBeenCalledWith({
      studentId: 'student-1',
      goals: ['Learn fractions'],
      topics: ['Math'],
      suggestedTasks: [],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'draft-1', status: 'draft' }),
    );
  });

  test('returns 401 when requestor is missing', async () => {
    const req = { body: { topics: ['Math'] } };
    const res = mockRes();

    await controller.createLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 403 when requestor is not a student', async () => {
    const req = { body: { requestor: educatorRequestor, topics: ['Math'] } };
    const res = mockRes();

    await controller.createLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 when no topics are selected', async () => {
    const req = { body: { requestor: studentRequestor, topics: [] } };
    const res = mockRes();

    await controller.createLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when topics is missing entirely', async () => {
    const req = { body: { requestor: studentRequestor } };
    const res = mockRes();

    await controller.createLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 500 on unexpected error', async () => {
    LessonPlanDraft.create.mockRejectedValue(new Error('DB down'));

    const req = { body: { requestor: studentRequestor, topics: ['Math'] } };
    const res = mockRes();

    await controller.createLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* =======================
   GET /educator/lesson-plan-drafts
   ======================= */

describe('getLessonPlanDrafts', () => {
  test('returns 200 with pending (draft-status) proposals', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlanDraft.find.mockReturnValue(
      makeChain([
        { _id: 'draft-1', status: 'draft', studentId: 'student-1' },
        { _id: 'draft-2', status: 'draft', studentId: 'student-2' },
      ]),
    );

    const req = { body: { requestor: educatorRequestor } };
    const res = mockRes();

    await controller.getLessonPlanDrafts(req, res);

    expect(LessonPlanDraft.find).toHaveBeenCalledWith({ status: 'draft' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ _id: 'draft-1' }),
      expect.objectContaining({ _id: 'draft-2' }),
    ]);
  });

  test('returns 401 when requestor is missing', async () => {
    const req = { body: {} };
    const res = mockRes();

    await controller.getLessonPlanDrafts(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 403 when requestor lacks the reviewLessonPlanDrafts permission', async () => {
    hasPermission.mockResolvedValue(false);

    const req = { body: { requestor: studentRequestor } };
    const res = mockRes();

    await controller.getLessonPlanDrafts(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 500 on unexpected error', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlanDraft.find.mockImplementation(() => {
      throw new Error('DB down');
    });

    const req = { body: { requestor: educatorRequestor } };
    const res = mockRes();

    await controller.getLessonPlanDrafts(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* =======================
   PUT /educator/lesson-plan-drafts/:draftId
   ======================= */

describe('updateLessonPlanDraft', () => {
  test('approves the draft, sets status active and educatorId, returns 200', async () => {
    hasPermission.mockResolvedValue(true);
    const save = jest.fn().mockResolvedValue(true);
    const draft = {
      _id: 'draft-1',
      status: 'draft',
      goals: ['Old goal'],
      topics: ['Math'],
      suggestedTasks: [],
      assessmentForms: [],
      educatorId: null,
      save,
    };
    LessonPlanDraft.findById.mockResolvedValue(draft);

    const req = {
      params: { draftId: 'draft-1' },
      body: {
        requestor: educatorRequestor,
        assessmentForms: [{ title: 'Quiz', description: '5 questions' }],
      },
    };
    const res = mockRes();

    await controller.updateLessonPlanDraft(req, res);

    expect(draft.status).toBe('active');
    expect(draft.educatorId).toBe('educator-1');
    expect(draft.assessmentForms).toEqual([{ title: 'Quiz', description: '5 questions' }]);
    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 401 when requestor is missing', async () => {
    const req = { params: { draftId: 'draft-1' }, body: {} };
    const res = mockRes();

    await controller.updateLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 403 when requestor lacks the reviewLessonPlanDrafts permission', async () => {
    hasPermission.mockResolvedValue(false);

    const req = { params: { draftId: 'draft-1' }, body: { requestor: studentRequestor } };
    const res = mockRes();

    await controller.updateLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 when the draft does not exist', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlanDraft.findById.mockResolvedValue(null);

    const req = { params: { draftId: 'missing' }, body: { requestor: educatorRequestor } };
    const res = mockRes();

    await controller.updateLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 500 on unexpected error', async () => {
    hasPermission.mockResolvedValue(true);
    LessonPlanDraft.findById.mockRejectedValue(new Error('DB down'));

    const req = { params: { draftId: 'draft-1' }, body: { requestor: educatorRequestor } };
    const res = mockRes();

    await controller.updateLessonPlanDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
