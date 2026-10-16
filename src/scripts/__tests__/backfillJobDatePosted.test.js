const flushPromises = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

const loadScript = async (updateManyImpl = null) => {
  jest.doMock('dotenv', () => ({ config: jest.fn() }));
  jest.doMock('mongoose', () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }));
  jest.doMock('../../models/jobs', () => ({
    updateMany: updateManyImpl || jest.fn().mockResolvedValue({ modifiedCount: 4 }),
  }));

  require('../backfillJobDatePosted');

  await flushPromises();
  await flushPromises();

  return {
    mongoose: require('mongoose'),
    Job: require('../../models/jobs'),
  };
};

describe('backfillJobDatePosted script', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.MONGO_URI = 'mongodb://localhost/test';
    jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects, backfills jobs missing datePosted, and disconnects', async () => {
    const { mongoose, Job } = await loadScript();

    expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URI);
    expect(Job.updateMany).toHaveBeenCalledWith(
      { $or: [{ datePosted: { $exists: false } }, { datePosted: null }] },
      { $set: { datePosted: expect.any(Date) } },
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('4'));
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits with an error when the backfill fails', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('db down'));

    await loadScript(failing);

    expect(console.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
