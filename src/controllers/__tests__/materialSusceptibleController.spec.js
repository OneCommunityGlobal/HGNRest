jest.mock('../../models/projectMaterial', () =>
  jest.fn().mockImplementation(function ProjectMaterial(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  }),
);

const { createProjectMaterial } = require('../materialSusceptibleController');

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('createProjectMaterial', () => {
  test('returns 400 when required fields are missing', async () => {
    const res = mockRes();
    await createProjectMaterial({ body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 for a non-positive replacedPercentage', async () => {
    const res = mockRes();
    await createProjectMaterial(
      {
        body: {
          projectName: 'P1',
          toolName: 'Drill',
          replacedPercentage: 0,
          date: '2026-01-01',
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('creates and saves a new project material entry', async () => {
    const res = mockRes();
    await createProjectMaterial(
      {
        body: {
          projectName: 'P1',
          toolName: 'Drill',
          replacedPercentage: 25,
          date: '2026-01-01',
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });
});
