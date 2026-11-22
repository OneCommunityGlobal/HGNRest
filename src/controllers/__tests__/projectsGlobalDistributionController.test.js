const mockBuildingFind = jest.fn();
const mockLegacyFind = jest.fn();

jest.mock('../../models/bmdashboard/buildingProject', () => ({
  find: mockBuildingFind,
}));

jest.mock('../../models/projectGlobalDistribution', () => ({
  find: mockLegacyFind,
}));

const getProjectsGlobalDistribution = require('../projectsGlobalDistributionController');

const makeFindChain = (result) => {
  const lean = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ lean });
  return { lean, select };
};

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('getProjectsGlobalDistribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an unsupported status before building a MongoDB query', async () => {
    const res = makeResponse();

    await getProjectsGlobalDistribution(
      { query: { statusFilter: { $ne: 'Active' } } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid project status' });
    expect(mockBuildingFind).not.toHaveBeenCalled();
    expect(mockLegacyFind).not.toHaveBeenCalled();
  });

  it('maps an allowed status to the legacy query safely', async () => {
    const res = makeResponse();
    const buildingChain = makeFindChain([]);
    const legacyChain = makeFindChain([{ region: 'North America' }]);
    mockBuildingFind.mockReturnValue(buildingChain);
    mockLegacyFind.mockReturnValue(legacyChain);

    await getProjectsGlobalDistribution({ query: { statusFilter: 'Active' } }, res);

    expect(mockBuildingFind).toHaveBeenCalledWith({ status: 'active' });
    expect(mockLegacyFind).toHaveBeenCalledWith({ status: 'Active' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { region: 'North America', percentage: '100.00' },
    ]);
  });
});
