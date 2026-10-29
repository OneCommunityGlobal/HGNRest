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
const { startRun, closeOpenRun, clearRuns, resolveRuns } = require('./sessionRuns');

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

describe('sessionRuns helpers', () => {
  it('opens a run on start and closes it at the pause time', () => {
    const client = { started: false, time: 5 * HOUR, runs: [] };
    startRun(client, at('2026-10-27T05:42:00Z'));
    expect(client.runs).toEqual([{ startedAt: at('2026-10-27T05:42:00Z'), endedAt: null }]);

    closeOpenRun(client, at('2026-10-27T06:12:00Z'));
    expect(client.runs[0].endedAt).toEqual(at('2026-10-27T06:12:00Z'));
  });

  it('stops counting at zero when the pause arrives hours later', () => {
    const client = { started: false, time: 5 * HOUR, runs: [] };
    startRun(client, at('2026-10-27T05:42:00Z'));

    closeOpenRun(client, at('2026-10-27T17:45:00Z'));
    expect(client.runs[0].endedAt).toEqual(at('2026-10-27T10:42:00Z'));
  });

  it('never leaves two open runs when start is sent twice', () => {
    const client = { started: true, time: 5 * HOUR, runs: [] };
    startRun(client, at('2026-10-27T18:00:00Z'));
    startRun(client, at('2026-10-27T18:10:00Z'));

    expect(client.runs).toHaveLength(2);
    expect(client.runs[0].endedAt).toEqual(at('2026-10-27T18:10:00Z'));
    expect(client.runs[1].endedAt).toBeNull();
  });

  it('starts a fresh list for a new session', () => {
    const client = {
      started: false,
      time: 5 * HOUR,
      runs: [{ startedAt: at('2026-10-26T18:00:00Z'), endedAt: at('2026-10-26T19:00:00Z') }],
    };
    startRun(client, at('2026-10-27T18:00:00Z'));

    expect(client.runs).toHaveLength(1);
    expect(client.runs[0].startedAt).toEqual(at('2026-10-27T18:00:00Z'));
  });

  it('copes with a timer saved before runs existed', () => {
    const client = { started: true, time: 5 * HOUR };
    startRun(client, at('2026-10-27T18:00:00Z'));
    expect(client.runs).toHaveLength(1);
  });

  it('resolves the run that is still counting, capped at the time left', () => {
    const client = {
      started: true,
      time: 2 * HOUR,
      runs: [
        { startedAt: at('2026-10-27T02:00:00Z'), endedAt: at('2026-10-27T03:00:00Z') },
        { startedAt: at('2026-10-27T04:00:00Z'), endedAt: null },
      ],
    };

    expect(resolveRuns(client, at('2026-10-27T05:00:00Z'))).toEqual([
      { startedAt: at('2026-10-27T02:00:00Z'), endedAt: at('2026-10-27T03:00:00Z'), open: false },
      { startedAt: at('2026-10-27T04:00:00Z'), endedAt: at('2026-10-27T05:00:00Z'), open: true },
    ]);
    expect(resolveRuns(client, at('2026-10-27T09:00:00Z'))[1].endedAt).toEqual(
      at('2026-10-27T06:00:00Z'),
    );
  });

  it('clears the runs', () => {
    const client = { runs: [{ startedAt: new Date(), endedAt: null }] };
    clearRuns(client);
    expect(client.runs).toEqual([]);
  });
});

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
