jest.mock('mongoose', () => ({ startSession: jest.fn() }));
jest.mock('../startup/logger', () => ({ logException: jest.fn() }));

const mongoose = require('mongoose');
const logger = require('../startup/logger');
const { withTransaction } = require('./transactionHelper');

describe('withTransaction', () => {
  let session;
  let callback;

  beforeEach(() => {
    jest.resetAllMocks();
    session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    mongoose.startSession.mockResolvedValue(session);
    callback = jest.fn().mockResolvedValue('result');
  });

  it('starts the transaction, passes the session to the callback, and commits before cleanup', async () => {
    const steps = [];
    session.startTransaction.mockImplementation(() => steps.push('start'));
    callback.mockImplementation(async () => {
      steps.push('callback');
      return 'result';
    });
    session.commitTransaction.mockImplementation(async () => {
      steps.push('commit');
    });
    session.endSession.mockImplementation(async () => {
      steps.push('end');
    });

    await expect(withTransaction(callback)).resolves.toBe('result');

    expect(mongoose.startSession).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(session);
    expect(steps).toEqual(['start', 'callback', 'commit', 'end']);
    expect(session.abortTransaction).not.toHaveBeenCalled();
  });

  it.each(['callback', 'commit'])('aborts and cleans up when the %s fails', async (stage) => {
    const error = new Error(`${stage} failed`);
    const failingOperation = stage === 'callback' ? callback : session.commitTransaction;
    failingOperation.mockRejectedValue(error);

    await expect(withTransaction(callback)).rejects.toBe(error);

    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(session.abortTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      session.endSession.mock.invocationCallOrder[0],
    );
    expect(logger.logException).not.toHaveBeenCalled();
    if (stage === 'callback') {
      expect(session.commitTransaction).not.toHaveBeenCalled();
    }
  });

  it('logs an abort failure and preserves the original error and session cleanup', async () => {
    const error = new Error('callback failed');
    const abortError = new Error('abort failed');
    callback.mockRejectedValue(error);
    session.abortTransaction.mockRejectedValue(abortError);

    await expect(withTransaction(callback)).rejects.toBe(error);

    expect(logger.logException).toHaveBeenCalledWith(abortError, 'Error aborting transaction');
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('propagates a session acquisition error without calling the callback', async () => {
    const error = new Error('startSession failed');
    mongoose.startSession.mockRejectedValue(error);

    await expect(withTransaction(callback)).rejects.toBe(error);

    expect(callback).not.toHaveBeenCalled();
  });
});
