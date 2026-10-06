/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

jest.mock('../../models/taskComment', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../models/studentTask', () => ({
  findOne: jest.fn(),
}));

/* =======================
   IMPORTS AFTER MOCKS
   ======================= */

const TaskComment = require('../../models/taskComment');
const StudentTask = require('../../models/studentTask');
const controller = require('../taskCommentController');

/* =======================
   TEST HELPERS
   ======================= */

const makeChain = (result) => {
  const promise = Promise.resolve(result);
  promise.sort = jest.fn(() => promise);
  promise.lean = jest.fn(() => promise);
  return promise;
};

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const studentRequestor = { requestorId: 'student-1', role: 'Student' };
const educatorRequestor = { requestorId: 'educator-1', role: 'Educator' };

beforeEach(() => {
  jest.clearAllMocks();
});

/* =======================
   POST /student/tasks/:taskId/comments
   ======================= */

describe('postStudentComments', () => {
  test('returns 201 and the created comment on success', async () => {
    StudentTask.findOne.mockResolvedValue({ taskId: 'task-1' });
    TaskComment.create.mockResolvedValue({
      _id: 'comment-1',
      taskId: 'task-1',
      userId: 'student-1',
      commentText: 'Great task',
      created_at: new Date('2026-01-01'),
    });

    const req = {
      params: { taskId: 'task-1' },
      body: { commentText: 'Great task', requestor: studentRequestor },
    };
    const res = mockRes();

    await controller.postStudentComments(req, res);

    expect(TaskComment.create).toHaveBeenCalledWith({
      taskId: 'task-1',
      userId: 'student-1',
      commentText: 'Great task',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 'comment-1', commentText: 'Great task' }),
    );
  });

  test('returns 401 when requestor is missing', async () => {
    const req = { params: { taskId: 'task-1' }, body: { commentText: 'Hi' } };
    const res = mockRes();

    await controller.postStudentComments(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 403 when requestor role is not a student', async () => {
    const req = {
      params: { taskId: 'task-1' },
      body: { commentText: 'Hi', requestor: educatorRequestor },
    };
    const res = mockRes();

    await controller.postStudentComments(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 when commentText is empty', async () => {
    const req = {
      params: { taskId: 'task-1' },
      body: { commentText: '   ', requestor: studentRequestor },
    };
    const res = mockRes();

    await controller.postStudentComments(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when the task does not exist', async () => {
    StudentTask.findOne.mockResolvedValue(null);

    const req = {
      params: { taskId: 'missing-task' },
      body: { commentText: 'Hi', requestor: studentRequestor },
    };
    const res = mockRes();

    await controller.postStudentComments(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 500 on unexpected error', async () => {
    StudentTask.findOne.mockRejectedValue(new Error('DB down'));

    const req = {
      params: { taskId: 'task-1' },
      body: { commentText: 'Hi', requestor: studentRequestor },
    };
    const res = mockRes();

    await controller.postStudentComments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* =======================
   GET /student/tasks/:taskId/comments
   ======================= */

describe('getStudentCommentsbyStudent', () => {
  test("returns 200 with only the requesting student's comments", async () => {
    StudentTask.findOne.mockResolvedValue({ taskId: 'task-1' });
    TaskComment.find.mockReturnValue(
      makeChain([
        {
          _id: 'c1',
          taskId: 'task-1',
          userId: 'student-1',
          commentText: 'Mine',
          created_at: new Date('2026-01-01'),
        },
      ]),
    );

    const req = { params: { taskId: 'task-1' }, body: { requestor: studentRequestor } };
    const res = mockRes();

    await controller.getStudentCommentsbyStudent(req, res);

    expect(TaskComment.find).toHaveBeenCalledWith(
      { taskId: 'task-1', isDeleted: false, userId: 'student-1' },
      { isDeleted: 0, __v: 0 },
    );
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ commentId: 'c1', commentText: 'Mine' }),
    ]);
  });

  test('returns 403 for a non-student requestor', async () => {
    const req = { params: { taskId: 'task-1' }, body: { requestor: educatorRequestor } };
    const res = mockRes();

    await controller.getStudentCommentsbyStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 when the task does not exist', async () => {
    StudentTask.findOne.mockResolvedValue(null);

    const req = { params: { taskId: 'missing' }, body: { requestor: studentRequestor } };
    const res = mockRes();

    await controller.getStudentCommentsbyStudent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* =======================
   GET /educator/tasks/:taskId/comments
   ======================= */

describe('getStudentCommentsbyEducator', () => {
  test('returns 200 with all comments on the task (not scoped to one user)', async () => {
    StudentTask.findOne.mockResolvedValue({ taskId: 'task-1' });
    TaskComment.find.mockReturnValue(
      makeChain([
        {
          _id: 'c1',
          taskId: 'task-1',
          userId: 'student-1',
          commentText: 'From student 1',
          created_at: new Date('2026-01-01'),
        },
        {
          _id: 'c2',
          taskId: 'task-1',
          userId: 'student-2',
          commentText: 'From student 2',
          created_at: new Date('2026-01-02'),
        },
      ]),
    );

    const req = { params: { taskId: 'task-1' }, body: { requestor: educatorRequestor } };
    const res = mockRes();

    await controller.getStudentCommentsbyEducator(req, res);

    expect(TaskComment.find).toHaveBeenCalledWith(
      { taskId: 'task-1', isDeleted: false },
      { isDeleted: 0, __v: 0 },
    );
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ commentId: 'c1' }),
      expect.objectContaining({ commentId: 'c2' }),
    ]);
  });

  test('returns 403 for a non-educator requestor', async () => {
    const req = { params: { taskId: 'task-1' }, body: { requestor: studentRequestor } };
    const res = mockRes();

    await controller.getStudentCommentsbyEducator(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

/* =======================
   DELETE /student/tasks/:taskId/comments/:commentId
   ======================= */

describe('deleteStudentComment', () => {
  test('soft-deletes the comment and returns 200 when the requester owns it', async () => {
    const save = jest.fn().mockResolvedValue(true);
    TaskComment.findOne.mockResolvedValue({
      _id: 'c1',
      taskId: 'task-1',
      userId: 'student-1',
      isDeleted: false,
      save,
    });

    const req = {
      params: { taskId: 'task-1', commentId: 'c1' },
      body: { requestor: studentRequestor },
    };
    const res = mockRes();

    await controller.deleteStudentComment(req, res);

    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 403 when the requester does not own the comment', async () => {
    TaskComment.findOne.mockResolvedValue({
      _id: 'c1',
      taskId: 'task-1',
      userId: 'someone-else',
      isDeleted: false,
      save: jest.fn(),
    });

    const req = {
      params: { taskId: 'task-1', commentId: 'c1' },
      body: { requestor: studentRequestor },
    };
    const res = mockRes();

    await controller.deleteStudentComment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 when the comment does not exist', async () => {
    TaskComment.findOne.mockResolvedValue(null);

    const req = {
      params: { taskId: 'task-1', commentId: 'missing' },
      body: { requestor: studentRequestor },
    };
    const res = mockRes();

    await controller.deleteStudentComment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 for a non-student requestor', async () => {
    const req = {
      params: { taskId: 'task-1', commentId: 'c1' },
      body: { requestor: educatorRequestor },
    };
    const res = mockRes();

    await controller.deleteStudentComment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
