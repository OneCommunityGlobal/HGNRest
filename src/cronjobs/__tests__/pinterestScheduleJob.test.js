// jest.mock calls come BEFORE the requires so the mocks are in place even if
// your Jest transformer does not hoist them (babel-jest normally does).
jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({ start: jest.fn() })),
}));

jest.mock('../../models/pinterestSchedule', () => ({
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../../controllers/socialMediaControllers', () => ({
  postPinImmediately: jest.fn(),
}));

const { CronJob } = require('cron');
const pinterestSchedule = require('../../models/pinterestSchedule');
const { postPinImmediately } = require('../../controllers/socialMediaControllers');
const pinterestScheduleJob = require('../pinterestScheduleJob');

// Helpers -------------------------------------------------------------------

const makePin = (overrides = {}) => ({
  _id: 'pin-1',
  postData: JSON.stringify({ title: 'Hello', board: 'b1' }),
  attempts: 0,
  ...overrides,
});

// Registers the job and returns the function CronJob would run each minute
const getTick = () => {
  pinterestScheduleJob();
  const { calls } = CronJob.mock;
  return calls[calls.length - 1][1];
};

// Makes findOneAndUpdate return each pin in turn, then null
const queuePins = (...pins) => {
  pins.forEach((pin) => pinterestSchedule.findOneAndUpdate.mockResolvedValueOnce(pin));
  pinterestSchedule.findOneAndUpdate.mockResolvedValue(null);
};

describe('pinterestScheduleJob', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks keeps implementations queued via mockResolvedValue, so reset them
    pinterestSchedule.findOneAndUpdate.mockReset();
    pinterestSchedule.deleteOne.mockReset();
    pinterestSchedule.updateOne.mockReset();
    postPinImmediately.mockReset();

    pinterestSchedule.findOneAndUpdate.mockResolvedValue(null);
    pinterestSchedule.deleteOne.mockResolvedValue({ deletedCount: 1 });
    pinterestSchedule.updateOne.mockResolvedValue({ modifiedCount: 1 });
    postPinImmediately.mockResolvedValue(undefined);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('scheduling', () => {
    it('creates a cron job that runs every minute', () => {
      pinterestScheduleJob();

      expect(CronJob).toHaveBeenCalledTimes(1);
      expect(CronJob).toHaveBeenCalledWith('* * * * *', expect.any(Function));
    });

    it('starts the job and returns it', () => {
      const job = pinterestScheduleJob();

      expect(job.start).toHaveBeenCalledTimes(1);
      expect(job).toBe(CronJob.mock.results[0].value);
    });
  });

  describe('claiming due pins', () => {
    it('does nothing when no pins are due', async () => {
      const tick = getTick();

      await tick();

      expect(pinterestSchedule.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(postPinImmediately).not.toHaveBeenCalled();
      expect(pinterestSchedule.deleteOne).not.toHaveBeenCalled();
      expect(pinterestSchedule.updateOne).not.toHaveBeenCalled();
    });

    it('atomically claims the oldest due pending pin', async () => {
      const tick = getTick();
      const before = Date.now();

      await tick();

      const [filter, update, options] = pinterestSchedule.findOneAndUpdate.mock.calls[0];

      expect(filter.scheduledTime.$lte).toBeInstanceOf(Date);
      expect(filter.scheduledTime.$lte.getTime()).toBeGreaterThanOrEqual(before);
      expect(filter.status).toEqual({ $in: [undefined, null, 'pending'] });

      expect(update.$set.status).toBe('processing');
      expect(update.$set.processingStartedAt).toBeInstanceOf(Date);

      expect(options).toEqual({ sort: { scheduledTime: 1 }, new: true });
    });
  });

  describe('successful posting', () => {
    it('parses postData, posts the pin, then deletes it by _id', async () => {
      queuePins(makePin({ _id: 'abc' }));
      const tick = getTick();

      await tick();

      expect(postPinImmediately).toHaveBeenCalledTimes(1);
      expect(postPinImmediately).toHaveBeenCalledWith({ title: 'Hello', board: 'b1' });
      expect(pinterestSchedule.deleteOne).toHaveBeenCalledWith({ _id: 'abc' });
      expect(pinterestSchedule.updateOne).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('deletes only after the pin has been posted', async () => {
      const order = [];
      postPinImmediately.mockImplementation(async () => order.push('post'));
      pinterestSchedule.deleteOne.mockImplementation(async () => order.push('delete'));
      queuePins(makePin());
      const tick = getTick();

      await tick();

      expect(order).toEqual(['post', 'delete']);
    });

    it('keeps claiming until the queue is empty and processes every pin', async () => {
      queuePins(
        makePin({ _id: 'a', postData: JSON.stringify({ n: 1 }) }),
        makePin({ _id: 'b', postData: JSON.stringify({ n: 2 }) }),
        makePin({ _id: 'c', postData: JSON.stringify({ n: 3 }) }),
      );
      const tick = getTick();

      await tick();

      // 3 pins + 1 final call that returns null
      expect(pinterestSchedule.findOneAndUpdate).toHaveBeenCalledTimes(4);
      expect(postPinImmediately.mock.calls.map(([d]) => d)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
      expect(pinterestSchedule.deleteOne.mock.calls.map(([f]) => f._id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('failure handling', () => {
    it('marks the pin pending and increments attempts when posting fails', async () => {
      postPinImmediately.mockRejectedValueOnce(new Error('Pinterest API down'));
      queuePins(makePin({ _id: 'x', attempts: 0 }));
      const tick = getTick();

      await tick();

      expect(pinterestSchedule.deleteOne).not.toHaveBeenCalled();
      expect(pinterestSchedule.updateOne).toHaveBeenCalledWith(
        { _id: 'x' },
        { $set: { status: 'pending', attempts: 1, lastError: 'Pinterest API down' } },
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to post scheduled pin x:',
        expect.any(Error),
      );
    });

    it('treats a missing attempts field as zero', async () => {
      postPinImmediately.mockRejectedValueOnce(new Error('fail'));
      queuePins(makePin({ attempts: undefined }));
      const tick = getTick();

      await tick();

      const [, update] = pinterestSchedule.updateOne.mock.calls[0];
      expect(update.$set.attempts).toBe(1);
      expect(update.$set.status).toBe('pending');
    });

    it('keeps the pin pending while attempts are below the maximum', async () => {
      postPinImmediately.mockRejectedValueOnce(new Error('fail'));
      queuePins(makePin({ attempts: 1 })); // becomes attempt 2 of 3
      const tick = getTick();

      await tick();

      const [, update] = pinterestSchedule.updateOne.mock.calls[0];
      expect(update.$set).toMatchObject({ status: 'pending', attempts: 2 });
    });

    it('marks the pin failed once the maximum number of attempts is reached', async () => {
      postPinImmediately.mockRejectedValueOnce(new Error('still broken'));
      queuePins(makePin({ attempts: 2 })); // becomes attempt 3 of 3
      const tick = getTick();

      await tick();

      const [, update] = pinterestSchedule.updateOne.mock.calls[0];
      expect(update.$set).toEqual({
        status: 'failed',
        attempts: 3,
        lastError: 'still broken',
      });
    });

    it('records a failure for malformed postData without calling Pinterest', async () => {
      queuePins(makePin({ postData: '{not valid json' }));
      const tick = getTick();

      await tick();

      expect(postPinImmediately).not.toHaveBeenCalled();
      expect(pinterestSchedule.deleteOne).not.toHaveBeenCalled();

      const [filter, update] = pinterestSchedule.updateOne.mock.calls[0];
      expect(filter).toEqual({ _id: 'pin-1' });
      expect(update.$set.status).toBe('pending');
      expect(update.$set.lastError).toMatch(/JSON/i);
    });

    it('stringifies non-Error rejections for lastError', async () => {
      postPinImmediately.mockRejectedValueOnce('plain string failure');
      queuePins(makePin());
      const tick = getTick();

      await tick();

      const [, update] = pinterestSchedule.updateOne.mock.calls[0];
      expect(update.$set.lastError).toBe('plain string failure');
    });

    it('treats a failed delete as a failure and records it', async () => {
      pinterestSchedule.deleteOne.mockRejectedValueOnce(new Error('DB delete failed'));
      queuePins(makePin({ _id: 'd1' }));
      const tick = getTick();

      await tick();

      expect(postPinImmediately).toHaveBeenCalledTimes(1);
      expect(pinterestSchedule.updateOne).toHaveBeenCalledWith(
        { _id: 'd1' },
        { $set: { status: 'pending', attempts: 1, lastError: 'DB delete failed' } },
      );
    });

    it('does not let one failing pin block the pins after it', async () => {
      postPinImmediately
        .mockResolvedValueOnce(undefined) // pin a succeeds
        .mockRejectedValueOnce(new Error('boom')) // pin b fails
        .mockResolvedValueOnce(undefined); // pin c succeeds
      queuePins(makePin({ _id: 'a' }), makePin({ _id: 'b' }), makePin({ _id: 'c' }));
      const tick = getTick();

      await tick();

      expect(postPinImmediately).toHaveBeenCalledTimes(3);
      expect(pinterestSchedule.deleteOne.mock.calls.map(([f]) => f._id)).toEqual(['a', 'c']);
      expect(pinterestSchedule.updateOne).toHaveBeenCalledTimes(1);
      expect(pinterestSchedule.updateOne.mock.calls[0][0]).toEqual({ _id: 'b' });
    });
  });

  describe('job-level error handling', () => {
    it('logs and swallows errors thrown while claiming pins', async () => {
      const dbError = new Error('Mongo connection lost');
      pinterestSchedule.findOneAndUpdate.mockRejectedValueOnce(dbError);
      const tick = getTick();

      await expect(tick()).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Pinterest schedule job error:', dbError);
      expect(postPinImmediately).not.toHaveBeenCalled();
    });

    it('logs and swallows errors thrown while recording a failure', async () => {
      postPinImmediately.mockRejectedValueOnce(new Error('post failed'));
      const updateError = new Error('update failed');
      pinterestSchedule.updateOne.mockRejectedValueOnce(updateError);
      queuePins(makePin());
      const tick = getTick();

      await expect(tick()).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Pinterest schedule job error:', updateError);
    });

    it('releases the running lock after an error so the next tick can run', async () => {
      pinterestSchedule.findOneAndUpdate.mockRejectedValueOnce(new Error('transient'));
      const tick = getTick();

      await tick();
      expect(pinterestSchedule.findOneAndUpdate).toHaveBeenCalledTimes(1);

      await tick();
      expect(pinterestSchedule.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('overlap protection', () => {
    it('skips a tick while the previous run is still in progress', async () => {
      let releaseFirstRun;
      pinterestSchedule.findOneAndUpdate.mockReturnValueOnce(
        new Promise((resolve) => {
          releaseFirstRun = resolve;
        }),
      );
      const tick = getTick();

      const firstRun = tick(); // hangs on findOneAndUpdate
      await tick(); // should return immediately

      expect(pinterestSchedule.findOneAndUpdate).toHaveBeenCalledTimes(1);

      releaseFirstRun(null);
      await firstRun;
    });

    it('allows a new run once the previous one has finished', async () => {
      const tick = getTick();

      await tick();
      await tick();

      expect(pinterestSchedule.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('keeps separate lock state for each registered job', async () => {
      let releaseFirstRun;
      pinterestSchedule.findOneAndUpdate.mockReturnValueOnce(
        new Promise((resolve) => {
          releaseFirstRun = resolve;
        }),
      );
      const tickA = getTick();
      const tickB = getTick();

      const runA = tickA(); // A is busy
      await tickB(); // B has its own lock, so it runs

      expect(pinterestSchedule.findOneAndUpdate).toHaveBeenCalledTimes(2);

      releaseFirstRun(null);
      await runA;
    });
  });
});
