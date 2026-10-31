const controllerFactory = require('../bmIssueController');
const BuildingIssue = require('../../../models/bmdashboard/buildingIssue');

const id = '507f1f77bcf86cd799439011';
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const lean = (rows) => ({ lean: jest.fn().mockResolvedValue(rows) });

describe('Logged issues in the issue dashboard', () => {
  it('includes existing building issues and injuries with dashboard fields', async () => {
    const building = {
      _id: id,
      issueTitle: [],
      issueText: ['Logged safety issue'],
      issueType: 'Safety',
      issueDate: '2026-10-26',
      createdDate: '2026-10-31',
    };
    const injury = { _id: 'injury', name: 'Injury', openDate: '2026-10-20' };
    const injuryQuery = lean([injury]);
    injuryQuery.populate = jest.fn().mockReturnThis();
    const controller = controllerFactory(
      { find: jest.fn(() => lean([building])) },
      { find: jest.fn(() => injuryQuery) },
    );
    const res = response();
    await controller.bmGetInjuryIssue({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { ...building, name: 'Logged safety issue', category: 'Safety', openDate: '2026-10-26' },
      injury,
    ]);
  });

  it.each([true, false])('persists form consequences and resolved=%s', async (resolved) => {
    const create = jest.fn(async (payload) => new BuildingIssue(payload));
    const controller = controllerFactory({ create }, {});
    const res = response();
    await controller.bmPostIssue(
      {
        body: {
          issueDate: '2026-10-26',
          projectId: id,
          createdBy: id,
          issueType: 'Safety',
          issueText: 'Logged issue',
          issueConsequences: ['Minor Injury'],
          issueResolved: resolved,
        },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const saved = res.json.mock.calls[0][0];
    expect(Array.from(saved.issueConsequences)).toEqual(['Minor Injury']);
    expect(saved.status).toBe(resolved ? 'closed' : 'open');
    expect(Boolean(saved.closedDate)).toBe(resolved);
  });

  it('renames building issues through the dashboard route', async () => {
    const findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: id });
    const controller = controllerFactory(
      { findByIdAndUpdate },
      { findByIdAndUpdate: jest.fn().mockResolvedValue(null) },
    );
    const res = response();
    await controller.bmRenameInjuryIssue(
      { params: { id }, body: { newName: 'Safety incident' } },
      res,
    );
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      id,
      { issueTitle: ['Safety incident'] },
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deletes building issues through the dashboard route', async () => {
    const findByIdAndDelete = jest.fn().mockResolvedValue({ _id: id });
    const controller = controllerFactory(
      { findByIdAndDelete },
      { findByIdAndDelete: jest.fn().mockResolvedValue(null) },
    );
    const res = response();
    await controller.bmDeleteInjuryIssue({ params: { id } }, res);
    expect(findByIdAndDelete).toHaveBeenCalledWith(id);
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('copies a logged issue without reusing its database identity', async () => {
    const building = {
      _id: id,
      __v: 2,
      projectId: id,
      issueType: 'Safety',
      issueTitle: [],
      issueText: ['Details'],
    };
    const create = jest.fn().mockResolvedValue({ _id: 'copy' });
    const controller = controllerFactory(
      { findById: jest.fn(() => lean(building)), create },
      { findById: jest.fn(() => lean(null)) },
    );
    const res = response();
    await controller.bmCopyInjuryIssue({ params: { id } }, res);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        issueTitle: ['Safety (Copy)'],
        projectId: id,
        issueText: ['Details'],
      }),
    );
    expect(create.mock.calls[0][0]).not.toHaveProperty('_id');
    expect(create.mock.calls[0][0]).not.toHaveProperty('__v');
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
