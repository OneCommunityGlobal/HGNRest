jest.mock('../../../models/bmdashboard/projectBudget', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  exists: jest.fn(),
}));

jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
}));

const ProjectBudget = require('../../../models/bmdashboard/projectBudget');
const BuildingProject = require('../../../models/bmdashboard/buildingProject');
const logger = require('../../../startup/logger');
const { getProjectBudget, setProjectBudget, parseBudget } = require('../projectBudgetController');

const PROJECT_ID = '507f1f77bcf86cd799439011';
const ADMIN_ID = '507f1f77bcf86cd799439099';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

// Mongoose-like query: chainable populate/lean and awaitable directly
const query = (result) => {
  const q = {
    populate: jest.fn(() => q),
    lean: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
};

const validBody = (overrides = {}) => ({
  categories: { labor: 4000, materials: 3000, equipment: 2000 },
  effectiveDate: '2026-11-01',
  requestor: { requestorId: ADMIN_ID, role: 'Administrator' },
  ...overrides,
});

const putReq = (body = validBody()) => ({ params: { projectId: PROJECT_ID }, body });

describe('projectBudgetController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BuildingProject.exists.mockResolvedValue({ _id: PROJECT_ID });
  });

  describe('getProjectBudget', () => {
    it('returns 400 for an invalid project id', async () => {
      const res = makeRes();
      await getProjectBudget({ params: { projectId: 'bad' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(ProjectBudget.findOne).not.toHaveBeenCalled();
    });

    it('returns null when no budget is set', async () => {
      ProjectBudget.findOne.mockReturnValue(query(null));
      const res = makeRes();
      await getProjectBudget({ params: { projectId: PROJECT_ID } }, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ budget: null });
    });

    it('returns the budget with the setter names populated', async () => {
      const budget = {
        projectId: PROJECT_ID,
        categories: { labor: 1, materials: 2, equipment: 3 },
      };
      const q = query(budget);
      ProjectBudget.findOne.mockReturnValue(q);
      const res = makeRes();
      await getProjectBudget({ params: { projectId: PROJECT_ID } }, res);
      expect(q.populate).toHaveBeenCalledWith('setBy', 'firstName lastName');
      expect(q.populate).toHaveBeenCalledWith('history.setBy', 'firstName lastName');
      expect(res.json).toHaveBeenCalledWith({ budget });
    });

    it('returns 500 and logs on a DB error', async () => {
      const error = new Error('DB down');
      ProjectBudget.findOne.mockReturnValue({
        populate() {
          return this;
        },
        lean: () => Promise.reject(error),
      });
      const res = makeRes();
      await getProjectBudget({ params: { projectId: PROJECT_ID } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.logException).toHaveBeenCalled();
    });
  });

  describe('setProjectBudget', () => {
    it.each(['Manager', 'Volunteer', undefined])('returns 403 for role %s', async (role) => {
      const res = makeRes();
      await setProjectBudget(
        putReq(validBody({ requestor: { requestorId: ADMIN_ID, role } })),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(ProjectBudget.findOne).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid project id', async () => {
      const res = makeRes();
      await setProjectBudget({ params: { projectId: 'bad' }, body: validBody() }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 with the validation errors', async () => {
      const res = makeRes();
      await setProjectBudget(
        putReq(validBody({ categories: { labor: -1, materials: 0, equipment: 0 } })),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].errors).toContain('Labor must be a number of 0 or more');
    });

    it('returns 404 when the project does not exist', async () => {
      BuildingProject.exists.mockResolvedValue(null);
      const res = makeRes();
      await setProjectBudget(putReq(), res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(ProjectBudget.create).not.toHaveBeenCalled();
    });

    it('creates the first budget for a project', async () => {
      const saved = { projectId: PROJECT_ID, history: [] };
      ProjectBudget.findOne.mockReturnValueOnce(query(null)).mockReturnValueOnce(query(saved));
      const res = makeRes();

      await setProjectBudget(putReq(), res);

      expect(ProjectBudget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          categories: { labor: 4000, materials: 3000, equipment: 2000 },
          expenditureTypes: undefined,
          setBy: ADMIN_ID,
          history: [],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ budget: saved });
    });

    it('keeps the previous version in history when editing', async () => {
      const previous = {
        categories: { labor: 1000, materials: 1000, equipment: 1000 },
        expenditureTypes: { plumbing: 3000, electrical: 0, structural: 0, mechanical: 0 },
        effectiveDate: new Date('2026-10-01'),
        setBy: 'someone',
        updatedAt: new Date('2026-10-02'),
        history: [{ setAt: new Date('2026-09-01') }],
      };
      const existing = {
        toObject: () => previous,
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(),
      };
      ProjectBudget.findOne
        .mockReturnValueOnce(query(existing))
        .mockReturnValueOnce(query({ projectId: PROJECT_ID }));
      const res = makeRes();

      await setProjectBudget(putReq(), res);

      expect(existing.history).toHaveLength(2);
      expect(existing.history[0]).toEqual({
        categories: previous.categories,
        expenditureTypes: previous.expenditureTypes,
        effectiveDate: previous.effectiveDate,
        setBy: 'someone',
        setAt: previous.updatedAt,
      });
      expect(existing.set).toHaveBeenCalledWith(
        expect.objectContaining({ categories: { labor: 4000, materials: 3000, equipment: 2000 } }),
      );
      // The new body has no type split, so the old one is cleared
      expect(existing.set).toHaveBeenCalledWith('expenditureTypes', undefined);
      expect(existing.save).toHaveBeenCalled();
      expect(ProjectBudget.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('parseBudget', () => {
    it('accepts numeric strings and an optional type split that matches the total', () => {
      const { value, errors } = parseBudget({
        categories: { labor: '100', materials: '50', equipment: '50' },
        expenditureTypes: { plumbing: 50, electrical: 50, structural: 50, mechanical: 50 },
        effectiveDate: '2026-11-01',
      });
      expect(errors).toBeUndefined();
      expect(value.categories).toEqual({ labor: 100, materials: 50, equipment: 50 });
      expect(value.expenditureTypes.mechanical).toBe(50);
    });

    it('rejects a zero total, a missing category and a missing date', () => {
      expect(
        parseBudget({
          categories: { labor: 0, materials: 0, equipment: 0 },
          effectiveDate: '2026-11-01',
        }).errors,
      ).toEqual(['The total budget must be greater than 0']);
      expect(
        parseBudget({ categories: { labor: 1, materials: 1 }, effectiveDate: '2026-11-01' }).errors,
      ).toEqual(['Equipment must be a number of 0 or more']);
      expect(parseBudget({ categories: { labor: 1, materials: 1, equipment: 1 } }).errors).toEqual([
        'Effective date is required',
      ]);
    });

    it('requires all four types once one is given, and a matching sum', () => {
      const base = {
        categories: { labor: 100, materials: 0, equipment: 0 },
        effectiveDate: '2026-11-01',
      };
      expect(parseBudget({ ...base, expenditureTypes: { plumbing: 100 } }).errors).toEqual([
        'Electrical must be a number of 0 or more',
        'Structural must be a number of 0 or more',
        'Mechanical must be a number of 0 or more',
      ]);
      expect(
        parseBudget({
          ...base,
          expenditureTypes: { plumbing: 10, electrical: 10, structural: 10, mechanical: 10 },
        }).errors,
      ).toEqual(['Expenditure types must add up to the category total']);
    });
  });
});
