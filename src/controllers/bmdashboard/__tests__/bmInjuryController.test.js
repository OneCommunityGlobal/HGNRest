const mongoose = require('mongoose');
const buildingProject = require('../../../models/bmdashboard/buildingProject');
const createController = require('../bmInjuryController');

jest.spyOn(buildingProject, 'findById').mockImplementation(jest.fn());

const PROJECT_ID = '654946c8bc5772e8caf7e963';
const INCIDENT_ID = '6b0230f6a06db4b72e29249b';

const validBody = () => ({
  projectId: PROJECT_ID,
  date: '2025-06-15',
  severity: 'Major',
  injuryType: 'Cut',
  workerCategory: 'Electrical',
  description: 'Worker sustained a minor cut.',
});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (body = validBody(), query = {}) => ({
  body,
  query,
});

let injurySeverity;
let controller;

beforeEach(() => {
  jest.clearAllMocks();

  injurySeverity = {
    create: jest.fn(),
    aggregate: jest.fn(),
  };

  controller = createController(injurySeverity);

  buildingProject.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      name: 'Building 3',
    }),
  });
});

describe('POST injury', () => {
  test.each([
    ['invalid project ID', { projectId: 'invalid' }, 'Invalid project identifier.'],
    ['missing date', { date: '' }, 'Enter a valid incident date in YYYY-MM-DD format.'],
    [
      'impossible date',
      { date: '2025-02-30' },
      'Enter a valid incident date in YYYY-MM-DD format.',
    ],
    ['future date', { date: '2999-01-01' }, 'Incident date cannot be in the future.'],
    ['invalid severity', { severity: 'Serious' }, 'Select a valid injury severity.'],
    ['invalid injury type', { injuryType: 'Cut123' }, 'Enter a valid injury type using letters.'],
    [
      'invalid worker category',
      { workerCategory: 'Electrical123' },
      'Enter a valid worker category using letters.',
    ],
    [
      'short description',
      { description: 'Short' },
      'Enter a valid incident description (10–500 characters).',
    ],
    [
      'HTML in description',
      { description: '<script>alert(1)</script>' },
      'Enter a valid incident description (10–500 characters).',
    ],
  ])('rejects %s', async (_label, overrides, message) => {
    const res = makeRes();

    await controller.postInjury(
      makeReq({
        ...validBody(),
        ...overrides,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: message,
    });

    expect(buildingProject.findById).not.toHaveBeenCalled();
    expect(injurySeverity.create).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent project', async () => {
    buildingProject.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = makeRes();

    await controller.postInjury(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Project not found.',
    });

    expect(injurySeverity.create).not.toHaveBeenCalled();
  });

  it('creates one incident with normalized fields and its project name', async () => {
    const saved = {
      _id: INCIDENT_ID,
      projectName: 'Building 3',
    };

    injurySeverity.create.mockResolvedValue(saved);

    const res = makeRes();

    await controller.postInjury(
      makeReq({
        ...validBody(),
        injuryType: '  Cut  ',
        workerCategory: '  Electrical  ',
        description: '  Worker sustained a minor cut.  ',
      }),
      res,
    );

    expect(buildingProject.findById).toHaveBeenCalledWith(PROJECT_ID);

    expect(injurySeverity.create).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      date: new Date('2025-06-15T00:00:00.000Z'),
      severity: 'Major',
      injuryType: 'Cut',
      workerCategory: 'Electrical',
      department: 'Electrical',
      description: 'Worker sustained a minor cut.',
      count: 1,
      projectName: 'Building 3',
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Injury incident saved successfully.',
      injury: saved,
    });
  });

  it('returns 500 when saving fails', async () => {
    injurySeverity.create.mockRejectedValue(new Error('database unavailable'));

    const res = makeRes();

    await controller.postInjury(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unable to save the injury incident.',
    });
  });
});

describe('GET injury severity by project', () => {
  it('returns grouped injury counts without changing the dashboard response', async () => {
    const results = [
      {
        projectId: new mongoose.Types.ObjectId(PROJECT_ID),
        projectName: 'Building 3',
        severity: 'Major',
        department: 'Electrical',
        totalInjuries: 1,
      },
    ];

    injurySeverity.aggregate.mockResolvedValue(results);

    const res = makeRes();

    await controller.getInjuries(
      makeReq(undefined, {
        projectIds: PROJECT_ID,
      }),
      res,
    );

    const pipeline = injurySeverity.aggregate.mock.calls[0][0];

    expect(pipeline[0].$match.projectId.$in[0].toString()).toBe(PROJECT_ID);

    expect(pipeline[1].$group.totalInjuries).toEqual({
      $sum: '$count',
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(results);
  });

  it('rejects invalid project filters', async () => {
    const res = makeRes();

    await controller.getInjuries(
      makeReq(undefined, {
        projectIds: 'invalid',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(injurySeverity.aggregate).not.toHaveBeenCalled();
  });

  it('returns 500 if aggregation fails', async () => {
    injurySeverity.aggregate.mockRejectedValue(new Error('database unavailable'));

    const res = makeRes();

    await controller.getInjuries(makeReq(undefined, {}), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unable to fetch injury data.',
    });
  });
});
