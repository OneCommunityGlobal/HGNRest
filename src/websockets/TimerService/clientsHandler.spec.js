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

const { handleMessage, action, MAX_HOURS, MIN_MINS } = require('./clientsHandler');

const USER_ID = 'user-1';
const FIVE_HOURS_MS = MAX_HOURS * 60 * 60 * 1000;

const makeClient = (overrides = {}) => ({
  userId: USER_ID,
  startAt: new Date(),
  time: 900000,
  goal: 900000,
  initialGoal: 900000,
  chiming: false,
  paused: false,
  forcedPause: false,
  started: false,
  ...overrides,
});

// Pre-seeding the clients Map means getClient() returns this object directly
// without touching the (mocked) Timer model at all.
const makeClients = (overrides = {}) => {
  const clients = new Map();
  clients.set(USER_ID, makeClient(overrides));
  return clients;
};

describe('clientsHandler ADD_TO_GOAL / REMOVE_FROM_GOAL baseline sync (bug #4)', () => {
  it('idle: adding goal up to the 5h cap raises the baseline, so Reset keeps it after a session', async () => {
    const clients = makeClients();

    // Idle, same as the always-visible header +/- buttons: +15min repeatedly up
    // to (and past) the 5h cap.
    for (let i = 0; i < 25; i += 1) {
      await handleMessage({ action: action.ADD_GOAL, value: 15 * 60 * 1000 }, clients, USER_ID);
    }
    expect(clients.get(USER_ID).goal).toBe(FIVE_HOURS_MS);
    expect(clients.get(USER_ID).initialGoal).toBe(FIVE_HOURS_MS);

    // Start and stop (logging), leaving some time used - mirrors "logged a minute".
    await handleMessage({ action: action.START_TIMER }, clients, USER_ID);
    await handleMessage({ action: action.STOP_TIMER }, clients, USER_ID);
    expect(clients.get(USER_ID).started).toBe(false);

    // Reset should land back on the 5h baseline, not whatever time was left.
    await handleMessage({ action: action.CLEAR_TIMER }, clients, USER_ID);
    expect(clients.get(USER_ID).goal).toBe(FIVE_HOURS_MS);
  });

  it('started: adding goal only extends the session; Reset still returns to the pre-session baseline', async () => {
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const clients = makeClients({
      time: THIRTY_MIN_MS,
      goal: THIRTY_MIN_MS,
      initialGoal: THIRTY_MIN_MS,
    });

    await handleMessage({ action: action.START_TIMER }, clients, USER_ID);
    await handleMessage({ action: action.ADD_GOAL, value: 15 * 60 * 1000 }, clients, USER_ID); // +15 min mid-session

    expect(clients.get(USER_ID).goal).toBe(THIRTY_MIN_MS + 15 * 60 * 1000);
    expect(clients.get(USER_ID).initialGoal).toBe(THIRTY_MIN_MS); // unchanged - still the baseline

    await handleMessage({ action: action.CLEAR_TIMER }, clients, USER_ID);
    expect(clients.get(USER_ID).goal).toBe(THIRTY_MIN_MS); // abandons the mid-session extension
  });

  it('idle: removing goal below MIN_MINS is a no-op and does not touch the baseline', async () => {
    const oneMinute = 60 * 1000;
    const clients = makeClients({ time: oneMinute, goal: oneMinute, initialGoal: oneMinute });

    // Removing a full minute from a 1-minute goal would drop it below MIN_MINS.
    await handleMessage({ action: action.REMOVE_GOAL, value: oneMinute }, clients, USER_ID);

    expect(MIN_MINS).toBeGreaterThan(0);
    expect(clients.get(USER_ID).goal).toBe(oneMinute);
    expect(clients.get(USER_ID).initialGoal).toBe(oneMinute);
  });

  it('idle: removing goal reduces goal/time and keeps the baseline in sync', async () => {
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const FIFTEEN_MIN_MS = 15 * 60 * 1000;
    const clients = makeClients({
      time: THIRTY_MIN_MS,
      goal: THIRTY_MIN_MS,
      initialGoal: THIRTY_MIN_MS,
    });

    await handleMessage({ action: action.REMOVE_GOAL, value: FIFTEEN_MIN_MS }, clients, USER_ID);

    expect(clients.get(USER_ID).goal).toBe(FIFTEEN_MIN_MS);
    expect(clients.get(USER_ID).time).toBe(FIFTEEN_MIN_MS);
    expect(clients.get(USER_ID).initialGoal).toBe(FIFTEEN_MIN_MS);
  });
});

describe('clientsHandler ADD_TO_GOAL / REMOVE_FROM_GOAL only move the baseline when fresh', () => {
  it("idle after a partial log (goal diverged from the baseline): +15 only adjusts the leftover, Reset still returns to the original 31 min goal (Sripriya's case)", async () => {
    const THIRTY_ONE_MIN_MS = 31 * 60 * 1000;
    const FIFTEEN_MIN_MS = 15 * 60 * 1000;
    const clients = makeClients({
      started: true,
      startAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min into the session
      time: THIRTY_ONE_MIN_MS,
      goal: THIRTY_ONE_MIN_MS,
      initialGoal: THIRTY_ONE_MIN_MS,
    });

    // Logging partway through leaves goal = time left, diverged from initialGoal,
    // while still idle (started: false) - this is the "leftover" state that used
    // to be mistaken for "fresh".
    await handleMessage({ action: action.STOP_TIMER }, clients, USER_ID);
    expect(clients.get(USER_ID).started).toBe(false);
    expect(clients.get(USER_ID).goal).toBeLessThan(THIRTY_ONE_MIN_MS);
    expect(clients.get(USER_ID).goal).toBe(clients.get(USER_ID).time);
    expect(clients.get(USER_ID).initialGoal).toBe(THIRTY_ONE_MIN_MS);

    // Idle +/- after a partial log must only adjust the leftover, not drag the
    // baseline along with it.
    await handleMessage({ action: action.ADD_GOAL, value: FIFTEEN_MIN_MS }, clients, USER_ID);
    expect(clients.get(USER_ID).initialGoal).toBe(THIRTY_ONE_MIN_MS);

    await handleMessage({ action: action.CLEAR_TIMER }, clients, USER_ID);
    expect(clients.get(USER_ID).goal).toBe(THIRTY_ONE_MIN_MS);
  });

  it("idle after logging 1h out of a 5h baseline: +15 only adjusts the leftover, Reset still returns to 5h (vidiyala99's case)", async () => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const FIFTEEN_MIN_MS = 15 * 60 * 1000;
    const clients = makeClients({
      started: true,
      startAt: new Date(Date.now() - ONE_HOUR_MS),
      time: FIVE_HOURS_MS,
      goal: FIVE_HOURS_MS,
      initialGoal: FIVE_HOURS_MS,
    });

    await handleMessage({ action: action.STOP_TIMER }, clients, USER_ID);
    expect(clients.get(USER_ID).goal).toBeLessThan(FIVE_HOURS_MS);
    expect(clients.get(USER_ID).initialGoal).toBe(FIVE_HOURS_MS);

    await handleMessage({ action: action.ADD_GOAL, value: FIFTEEN_MIN_MS }, clients, USER_ID);
    expect(clients.get(USER_ID).initialGoal).toBe(FIVE_HOURS_MS);

    await handleMessage({ action: action.CLEAR_TIMER }, clients, USER_ID);
    expect(clients.get(USER_ID).goal).toBe(FIVE_HOURS_MS);
  });
});
