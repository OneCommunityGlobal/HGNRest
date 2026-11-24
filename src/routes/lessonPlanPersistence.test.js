/* eslint-disable import/order, import/newline-after-import */
const express = require('express');
const request = require('supertest');
jest.mock('../controllers/educatorController', () => () => ({
  assignTasks: jest.fn(),
  assignAtoms: jest.fn(),
  publishEvaluationResults: jest.fn(),
}));
jest.mock('../models/lessonPlan', () => {
  const Model = jest.fn();
  Model.findById = jest.fn();
  Model.findOneAndUpdate = jest.fn();
  return Model;
});
jest.mock('../models/activity', () => ({}));
jest.mock('../models/educationTask', () => ({ bulkWrite: jest.fn() }));
jest.mock('../models/userProfile', () => ({}));
jest.mock('../models/lessonPlanLog', () => ({ create: jest.fn() }));

const LessonPlan = require('../models/lessonPlan');
const EducationTask = require('../models/educationTask');
const LessonPlanLog = require('../models/lessonPlanLog');
const { Types: MongooseTypes } = require('mongoose');
const router = require('./educatorRouter');

const creator = '507f1f77bcf86cd799439011';
const otherUser = '507f1f77bcf86cd799439012';
const planId = '507f1f77bcf86cd799439013';
const baseUrl = '/api/educator/lesson-plans';
const payload = () => ({
  title: 'Research',
  theme: 'Science',
  description: 'Research checkpoints',
  startDate: '2030-01-01',
  endDate: '2030-02-01',
  subTasks: [
    { name: 'Summary', type: 'Write-only', dueDate: '2030-01-15', passMark: '8/10', weight: '40%' },
  ],
});

// Simulate global middleware's trusted identity replacement, never read identity from the payload.
const appFor = (role = 'Educator', requestorId = creator) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.body.requestor = role ? { role, requestorId } : undefined;
    next();
  });
  app.use('/api/educator', router);
  return app;
};
const save = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  LessonPlan.mockImplementation((values) => ({ ...values, save: () => save(values) }));
  save.mockImplementation(async (values) => ({ ...values, _id: planId }));
  const stored = {
    ...payload(),
    createdBy: creator,
    _id: planId,
    __v: 0,
    activities: ['existing-activity'],
  };
  LessonPlan.findById.mockResolvedValue({ ...stored, toObject: () => stored });
  LessonPlan.findOneAndUpdate.mockImplementation(async (filter, update) => ({
    ...stored,
    ...update.$set,
  }));
});

afterEach(() => {
  expect(EducationTask.bulkWrite).not.toHaveBeenCalled();
  expect(LessonPlanLog.create).not.toHaveBeenCalled();
});

describe('Lesson plan persistence routes', () => {
  test('creates metadata and subtasks using trusted identity and returns the saved ID', async () => {
    const response = await request(appFor())
      .post(baseUrl)
      .send({
        ...payload(),
        createdBy: otherUser,
        lastEditedBy: otherUser,
        activities: ['injected'],
        requestor: { role: 'Owner', requestorId: otherUser },
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ...payload(),
      _id: planId,
      createdBy: creator,
      lastEditedBy: creator,
      activities: [],
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('updates subtasks and metadata while retaining creator and activities', async () => {
    const subTasks = [
      { ...payload().subTasks[0], _id: otherUser, weight: '30', name: 'Updated summary' },
    ];
    const response = await request(appFor()).patch(`${baseUrl}/${planId}`).send({
      title: 'Updated',
      subTasks,
      createdBy: otherUser,
      lastEditedBy: otherUser,
      activities: [],
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      _id: planId,
      title: 'Updated',
      subTasks,
      createdBy: creator,
      activities: ['existing-activity'],
      lastEditedBy: creator,
    });
    expect(LessonPlan.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new MongooseTypes.ObjectId(planId),
        createdBy: new MongooseTypes.ObjectId(creator),
        __v: 0,
      },
      { $set: { title: 'Updated', subTasks, lastEditedBy: creator }, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
  });

  test.each(['Administrator', 'Owner'])('%s may update another educator’s plan', async (role) => {
    const response = await request(appFor(role, otherUser))
      .patch(`${baseUrl}/${planId}`)
      .send({ title: 'Admin edit' });
    expect(response.status).toBe(200);
    expect(response.body.lastEditedBy).toBe(otherUser);
    expect(LessonPlan.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: new MongooseTypes.ObjectId(planId),
      __v: 0,
    });
  });

  test('ignores MongoDB operators and uses validated ObjectId update filters', async () => {
    const response = await request(appFor())
      .patch(`${baseUrl}/${planId}`)
      .send({
        title: 'Safe update',
        $set: { createdBy: otherUser },
        _id: { $ne: null },
        __v: { $gt: -1 },
        createdBy: { $ne: null },
      });

    expect(response.status).toBe(200);
    expect(LessonPlan.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new MongooseTypes.ObjectId(planId),
        createdBy: new MongooseTypes.ObjectId(creator),
        __v: 0,
      },
      { $set: { title: 'Safe update', lastEditedBy: creator }, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
  });

  test('rejects operator-shaped values in editable fields', async () => {
    const response = await request(appFor())
      .patch(`${baseUrl}/${planId}`)
      .send({ title: { $ne: null } });

    expect(response.status).toBe(400);
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['', 401],
    ['Volunteer', 403],
    ['Manager', 403],
  ])('blocks role %s on both endpoints', async (role, status) => {
    const app = appFor(role);
    expect((await request(app).post(baseUrl).send(payload())).status).toBe(status);
    expect((await request(app).patch(`${baseUrl}/${planId}`).send(payload())).status).toBe(status);
    expect(save).not.toHaveBeenCalled();
    expect(LessonPlan.findById).not.toHaveBeenCalled();
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('educator cannot update another creator’s plan', async () => {
    const response = await request(appFor('Educator', otherUser))
      .patch(`${baseUrl}/${planId}`)
      .send(payload());
    expect(response.status).toBe(403);
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['title', ' '],
    ['startDate', 'invalid'],
    ['endDate', '2029-12-31'],
    ['startDate', '2030-02-30'],
    ['description', {}],
    ['subTasks', []],
    ['subTasks', null],
  ])('rejects invalid metadata %s on create and update', async (field, value) => {
    const body = { ...payload(), [field]: value };
    expect((await request(appFor()).post(baseUrl).send(body)).status).toBe(400);
    expect((await request(appFor()).patch(`${baseUrl}/${planId}`).send(body)).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['name', ' '],
    ['type', 'Unknown'],
    ['dueDate', ''],
    ['dueDate', '2030-02-30'],
    ['weight', ''],
    ['weight', 'abc'],
    ['weight', '-1'],
    ['weight', '101%'],
    ['weight', '40%%'],
    ['passMark', ''],
    ['passMark', 'abc'],
    ['passMark', '8'],
    ['passMark', '8/0'],
    ['passMark', '-1/10'],
    ['passMark', '11/10'],
    ['passMark', `${'9'.repeat(400)}/10`],
    ['_id', 'bad-id'],
  ])('rejects invalid subtask %s=%s on both endpoints', async (field, value) => {
    const body = payload();
    body.subTasks.push({ ...body.subTasks[0], [field]: value });
    expect((await request(appFor()).post(baseUrl).send(body)).status).toBe(400);
    expect((await request(appFor()).patch(`${baseUrl}/${planId}`).send(body)).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each(['0', '100%', '30.5%', '.5%'])(
    'accepts valid boundary/decimal weight %s',
    async (weight) => {
      const body = payload();
      body.subTasks[0].weight = weight;
      body.subTasks[0].passMark = '.5 / 10';
      expect((await request(appFor()).post(baseUrl).send(body)).status).toBe(201);
    },
  );

  test.each(['8/10', '8.5/10', '.5 / 10', '10.0/10.0'])(
    'accepts existing pass-mark format %s',
    async (passMark) => {
      const body = payload();
      body.subTasks[0].passMark = passMark;
      expect((await request(appFor()).post(baseUrl).send(body)).status).toBe(201);
    },
  );

  test.each([
    ['equal', '2030-01-01', 201, 200],
    ['later', '2030-02-01', 201, 200],
    ['earlier', '2029-12-31', 400, 400],
  ])(
    'handles an end date %s to the start date on create and partial update',
    async (order, endDate, createStatus, updateStatus) => {
      const created = await request(appFor())
        .post(baseUrl)
        .send({ ...payload(), endDate });
      // A partial update checks the new end date against the stored start date.
      const updated = await request(appFor()).patch(`${baseUrl}/${planId}`).send({ endDate });
      expect(created.status).toBe(createStatus);
      expect(updated.status).toBe(updateStatus);
      if (createStatus === 400) {
        expect(created.body.error).toBe('End date must be on or after start date');
        expect(updated.body.error).toBe('End date must be on or after start date');
        expect(save).not.toHaveBeenCalled();
        expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
      } else {
        expect(created.body.endDate).toBe(endDate);
        expect(updated.body.endDate).toBe(endDate);
      }
    },
  );

  test('validates partial date changes against the stored date', async () => {
    const response = await request(appFor())
      .patch(`${baseUrl}/${planId}`)
      .send({ startDate: '2030-03-01' });
    expect(response.status).toBe(400);
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects malformed IDs and empty updates', async () => {
    expect((await request(appFor()).patch(`${baseUrl}/invalid`).send(payload())).status).toBe(400);
    expect(LessonPlan.findById).not.toHaveBeenCalled();
    expect((await request(appFor()).patch(`${baseUrl}/${planId}`).send({})).status).toBe(400);
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 404 when the plan is missing', async () => {
    LessonPlan.findById.mockResolvedValue(null);
    expect((await request(appFor()).patch(`${baseUrl}/${planId}`).send(payload())).status).toBe(
      404,
    );
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 409 when the version/ownership-filtered write no longer matches', async () => {
    LessonPlan.findOneAndUpdate.mockResolvedValue(null);
    const response = await request(appFor()).patch(`${baseUrl}/${planId}`).send(payload());
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Lesson plan changed during this update. Reload it and try again.',
    });
  });

  test('returns 500 for failed create/update persistence without assigning', async () => {
    save.mockRejectedValue(new Error('database unavailable'));
    LessonPlan.findOneAndUpdate.mockRejectedValue(new Error('database unavailable'));
    const created = await request(appFor()).post(baseUrl).send(payload());
    const updated = await request(appFor()).patch(`${baseUrl}/${planId}`).send(payload());
    [created, updated].forEach((response) => {
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Unable to save lesson plan' });
    });
  });

  test('returns 400 for model validation failures', async () => {
    save.mockRejectedValue(Object.assign(new Error('validation'), { name: 'ValidationError' }));
    expect((await request(appFor()).post(baseUrl).send(payload())).status).toBe(400);
  });
});

describe('subtask identity uniqueness', () => {
  test.each([otherUser, otherUser.toUpperCase()])(
    'rejects duplicate IDs including case-equivalent %s on POST and PATCH',
    async (duplicateId) => {
      const body = payload();
      body.subTasks = [
        { ...body.subTasks[0], _id: otherUser },
        { ...body.subTasks[0], name: 'Another task', _id: duplicateId },
      ];
      const responses = [
        await request(appFor()).post(baseUrl).send(body),
        await request(appFor()).patch(`${baseUrl}/${planId}`).send({ subTasks: body.subTasks }),
      ];
      responses.forEach((response) => {
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Subtask IDs must be unique within a lesson plan' });
      });
      expect(save).not.toHaveBeenCalled();
      expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  test('preserves unique IDs while allowing multiple new ID-less subtasks on POST and PATCH', async () => {
    const body = payload();
    body.subTasks = [
      { ...body.subTasks[0], _id: otherUser },
      { ...body.subTasks[0], _id: creator.toUpperCase() },
      { ...body.subTasks[0], name: 'New task 1' },
      { ...body.subTasks[0], name: 'New task 2' },
    ];
    const created = await request(appFor()).post(baseUrl).send(body);
    const updated = await request(appFor())
      .patch(`${baseUrl}/${planId}`)
      .send({ subTasks: body.subTasks });
    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(save.mock.calls[0][0].subTasks).toEqual(body.subTasks);
    expect(LessonPlan.findOneAndUpdate.mock.calls[0][1].$set.subTasks).toEqual(body.subTasks);
  });

  test('normalizes ObjectId objects in stored plans when validating partial updates', async () => {
    const { Types } = require('mongoose');
    const stored = payload();
    stored.subTasks = [
      { ...stored.subTasks[0], _id: new Types.ObjectId(otherUser) },
      { ...stored.subTasks[0], _id: otherUser.toUpperCase() },
    ];
    LessonPlan.findById.mockResolvedValue({ createdBy: creator, toObject: () => stored });
    const response = await request(appFor())
      .patch(`${baseUrl}/${planId}`)
      .send({ title: 'Updated title' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Subtask IDs must be unique within a lesson plan');
    expect(LessonPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('atomic PATCH version checks', () => {
  test.each([0, undefined])(
    'rejects one overlapping update against version %s without persisting reversed dates',
    async (version) => {
      let stored = { ...payload(), _id: planId, createdBy: creator, endDate: '2030-01-31' };
      if (version !== undefined) stored.__v = version;
      let releaseReads;
      const bothRead = new Promise((resolve) => {
        releaseReads = resolve;
      });
      let reads = 0;
      LessonPlan.findById.mockImplementation(async () => {
        const snapshot = { ...stored };
        reads += 1;
        if (reads === 2) releaseReads();
        // Both controllers must validate the same snapshot before either may write.
        await bothRead;
        return { ...snapshot, toObject: () => snapshot };
      });
      const persisted = [];
      LessonPlan.findOneAndUpdate.mockImplementation(async (filter, update) => {
        // Evaluate the actual controller-generated compare-and-swap predicate.
        expect(filter).toMatchObject({
          _id: new MongooseTypes.ObjectId(planId),
          createdBy: new MongooseTypes.ObjectId(creator),
        });
        expect(filter).toHaveProperty('__v', version === undefined ? { $exists: false } : version);
        expect(update.$inc).toEqual({ __v: 1 });
        const matchesVersion =
          typeof filter.__v === 'object'
            ? filter.__v.$exists === false && stored.__v === undefined
            : filter.__v === stored.__v;
        if (!matchesVersion) return null;
        stored = { ...stored, ...update.$set, __v: (stored.__v || 0) + update.$inc.__v };
        persisted.push({ ...stored });
        return { ...stored };
      });
      const app = appFor();
      const responses = await Promise.all([
        request(app).patch(`${baseUrl}/${planId}`).send({ startDate: '2030-01-20' }),
        request(app).patch(`${baseUrl}/${planId}`).send({ endDate: '2030-01-10' }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(persisted).toHaveLength(1);
      expect(new Date(stored.startDate).getTime()).toBeLessThanOrEqual(
        new Date(stored.endDate).getTime(),
      );
      expect(stored.__v).toBe(1);
      // Retrying the losing request after rereading must now fail ordinary validation.
      LessonPlan.findById.mockImplementation(async () => ({
        ...stored,
        toObject: () => ({ ...stored }),
      }));
      const retryBody =
        responses[0].status === 409 ? { startDate: '2030-01-20' } : { endDate: '2030-01-10' };
      const retried = await request(app).patch(`${baseUrl}/${planId}`).send(retryBody);
      expect(retried.status).toBe(400);
      expect(LessonPlan.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(persisted).toHaveLength(1);
    },
  );
});
