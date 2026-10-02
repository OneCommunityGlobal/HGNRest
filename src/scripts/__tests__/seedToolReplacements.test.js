const flushPromises = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

const SUMMARY = {
  inserted: 8,
  removed: 3,
  seededProjects: [{ name: 'Building 1', id: 'abc123', toolCount: 4 }],
  missingProjects: [],
};

const loadScript = async (summary = SUMMARY, seedImpl = null) => {
  jest.doMock('dotenv', () => ({ config: jest.fn() }));
  jest.doMock('mongoose', () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }));
  jest.doMock('../../models/bmdashboard/buildingProject', () => ({ modelName: 'buildingProject' }));
  jest.doMock('../../models/toolReplacement', () => ({ modelName: 'ToolReplacement' }));
  jest.doMock('../../utilities/toolReplacementSeeder', () => ({
    seedToolReplacements: seedImpl || jest.fn().mockResolvedValue(summary),
  }));

  require('../seedToolReplacements');

  await flushPromises();
  await flushPromises();

  return {
    mongoose: require('mongoose'),
    seeder: require('../../utilities/toolReplacementSeeder'),
  };
};

describe('seedToolReplacements script', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      user: 'seed-user',
      password: 'p@ss word',
      cluster: 'cluster0.mongodb.net',
      dbName: 'hgnData_dev',
    };
    jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('connects, seeds, and disconnects', async () => {
    const { mongoose, seeder } = await loadScript();

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    const [uri] = mongoose.connect.mock.calls[0];
    expect(uri).toContain('cluster0.mongodb.net/hgnData_dev');
    expect(uri).toContain(encodeURIComponent('p@ss word'));
    expect(seeder.seedToolReplacements).toHaveBeenCalledWith({
      BuildingProject: { modelName: 'buildingProject' },
      ToolReplacement: { modelName: 'ToolReplacement' },
    });
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('warns about BM projects that were not found', async () => {
    await loadScript({ ...SUMMARY, missingProjects: ['Building 3'] });

    expect(console.warn).toHaveBeenCalledWith('BM projects not found (skipped):', 'Building 3');
  });

  it('exits with an error when required env vars are missing', async () => {
    delete process.env.cluster;

    const { mongoose } = await loadScript();

    expect(mongoose.connect).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits with an error when seeding fails', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('seed failed'));

    const { mongoose } = await loadScript(SUMMARY, failing);

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
