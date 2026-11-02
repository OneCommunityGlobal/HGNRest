jest.mock('../../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

jest.mock('../../models/timer', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../models/timelogTracking', () => ({
  create: jest.fn().mockResolvedValue(undefined),
}));

const { handleMessage, action } = require('./clientsHandler');

const USER_ID = 'user-1';
const HOUR = 60 * 60 * 1000;

const at = (iso) => new Date(iso);

const makeClients = (overrides = {}) => {
  const clients = new Map();
  clients.set(USER_ID, {
    userId: USER_ID,
    time: 5 * HOUR,
    goal: 5 * HOUR,
    initialGoal: 5 * HOUR,
    chiming: false,
    paused: false,
    forcedPause: false,
    started: false,
    ...overrides,
  });
  return clients;
};

const send = async (clients, act) => {
  const { timerResponse } = await handleMessage({ action: act }, clients, USER_ID);
  return JSON.parse(timerResponse);
};

describe('timer messages record runs', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records a run across start and pause and returns it with the timer state', async () => {
    const clients = makeClients();

    jest.setSystemTime(at('2026-10-27T05:42:00Z'));
    await send(clients, action.START_TIMER);

    jest.setSystemTime(at('2026-10-27T06:42:00Z'));
    const paused = await send(clients, action.PAUSE_TIMER);

    expect(paused.sessionRuns).toEqual([
      { startedAt: '2026-10-27T05:42:00.000Z', endedAt: '2026-10-27T06:42:00.000Z', open: false },
    ]);
  });

  it('keeps the runs of a session that is paused and resumed', async () => {
    const clients = makeClients();

    jest.setSystemTime(at('2026-10-27T05:00:00Z'));
    await send(clients, action.START_TIMER);
    jest.setSystemTime(at('2026-10-27T06:00:00Z'));
    await send(clients, action.PAUSE_TIMER);
    jest.setSystemTime(at('2026-10-27T15:00:00Z'));
    await send(clients, action.START_TIMER);
    jest.setSystemTime(at('2026-10-27T16:00:00Z'));
    const state = await send(clients, action.GET_TIMER);

    expect(state.sessionRuns).toEqual([
      { startedAt: '2026-10-27T05:00:00.000Z', endedAt: '2026-10-27T06:00:00.000Z', open: false },
      { startedAt: '2026-10-27T15:00:00.000Z', endedAt: '2026-10-27T16:00:00.000Z', open: true },
    ]);
  });

  it('records the real end of a run that finished while nobody was connected', async () => {
    const clients = makeClients();

    jest.setSystemTime(at('2026-10-27T05:42:00Z'));
    await send(clients, action.START_TIMER);

    jest.setSystemTime(at('2026-10-27T17:45:00Z'));
    const paused = await send(clients, action.PAUSE_TIMER);

    expect(paused.sessionRuns).toEqual([
      { startedAt: '2026-10-27T05:42:00.000Z', endedAt: '2026-10-27T10:42:00.000Z', open: false },
    ]);
  });

  it('clears the runs once the time is logged', async () => {
    const clients = makeClients();

    jest.setSystemTime(at('2026-10-27T05:42:00Z'));
    await send(clients, action.START_TIMER);
    jest.setSystemTime(at('2026-10-27T06:42:00Z'));
    await send(clients, action.PAUSE_TIMER);

    const stopped = await send(clients, action.STOP_TIMER);
    expect(stopped.sessionRuns).toEqual([]);
  });

  it('clears the runs when the timer is reset', async () => {
    const clients = makeClients();

    jest.setSystemTime(at('2026-10-27T05:42:00Z'));
    await send(clients, action.START_TIMER);
    jest.setSystemTime(at('2026-10-27T06:42:00Z'));

    const cleared = await send(clients, action.CLEAR_TIMER);
    expect(cleared.sessionRuns).toEqual([]);
  });
});
