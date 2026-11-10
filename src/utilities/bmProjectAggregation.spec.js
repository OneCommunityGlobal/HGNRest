const mongoose = require('mongoose');
const { getUniqueProjectsWithNames } = require('./bmProjectAggregation');

describe('getUniqueProjectsWithNames', () => {
  test('returns project IDs and names without mutating aggregation results', async () => {
    const projectId = new mongoose.Types.ObjectId();
    const row = Object.freeze({
      _id: projectId,
      projectName: 'Earthbag Village',
      extra: 'internal',
    });
    const rows = Object.freeze([row]);
    const Model = { aggregate: jest.fn().mockResolvedValue(rows) };

    const result = await getUniqueProjectsWithNames(Model);

    expect(result).toEqual([{ projectId, projectName: 'Earthbag Village' }]);
    expect(result[0].projectId).toBe(projectId);
    expect(result).not.toBe(rows);
    expect(result[0]).not.toBe(row);
    expect(row).toEqual({ _id: projectId, projectName: 'Earthbag Village', extra: 'internal' });
    expect(Model.aggregate).toHaveBeenCalledTimes(1);
  });

  test.each([undefined, null, ''])(
    'uses the fallback for a missing name: %p',
    async (projectName) => {
      const projectId = new mongoose.Types.ObjectId();
      const Model = { aggregate: jest.fn().mockResolvedValue([{ _id: projectId, projectName }]) };

      await expect(getUniqueProjectsWithNames(Model)).resolves.toEqual([
        { projectId, projectName: 'Unknown Project' },
      ]);
    },
  );

  test('returns an empty list when the model has no project groups', async () => {
    const Model = { aggregate: jest.fn().mockResolvedValue([]) };

    await expect(getUniqueProjectsWithNames(Model)).resolves.toEqual([]);
  });

  test('propagates a rejected database operation to the caller', async () => {
    const error = new Error('Aggregation unavailable');
    const Model = { aggregate: jest.fn().mockRejectedValue(error) };

    await expect(getUniqueProjectsWithNames(Model)).rejects.toBe(error);
    expect(Model.aggregate).toHaveBeenCalledTimes(1);
  });

  test('rejects with the original error if aggregate throws synchronously', async () => {
    const error = new Error('Cannot construct aggregation');
    const Model = {
      aggregate: jest.fn(() => {
        throw error;
      }),
    };

    await expect(getUniqueProjectsWithNames(Model)).rejects.toBe(error);
  });

  test('keeps separate model calls independent', async () => {
    const issueId = new mongoose.Types.ObjectId();
    const stoppageId = new mongoose.Types.ObjectId();
    const Issue = {
      aggregate: jest.fn().mockResolvedValue([{ _id: issueId, projectName: 'Issue' }]),
    };
    const Stoppage = {
      aggregate: jest.fn().mockResolvedValue([{ _id: stoppageId, projectName: 'Stoppage' }]),
    };

    const [issues, stoppages] = await Promise.all([
      getUniqueProjectsWithNames(Issue),
      getUniqueProjectsWithNames(Stoppage),
    ]);

    expect(issues).toEqual([{ projectId: issueId, projectName: 'Issue' }]);
    expect(stoppages).toEqual([{ projectId: stoppageId, projectName: 'Stoppage' }]);
  });
});
