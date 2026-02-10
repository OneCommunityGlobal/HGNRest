/* eslint-disable no-multi-assign */
/* eslint-disable radix */
const moment = require('moment');
const Timer = require('../../models/timer');
const TimelogTracking = require('../../models/timelogTracking');
const logger = require('../../startup/logger');

const getClient = async (clients, userId) => {
  // In case of there is already a connection that is open for this user
  // for example user open a new connection
  if (!clients.has(userId)) {
    try {
      let timer = await Timer.findOne({ userId });
      if (!timer) timer = await Timer.create({ userId });
      clients.set(userId, timer);
    } catch (e) {
      logger.logException(e);
      throw new Error('Something happened when trying to retrieve timer from mongo');
    }
  }
  return clients.get(userId);
};

const saveClient = async (client) => {
  try {
    await Timer.findOneAndUpdate({ userId: client.userId }, client);
  } catch (e) {
    logger.logException(e);
    throw new Error(`Something happened when trying to save user timer to mongo, Error: ${e}`);
  }
};

const action = {
  START_TIMER: 'START_TIMER',
  PAUSE_TIMER: 'PAUSE_TIMER',
  STOP_TIMER: 'STOP_TIMER',
  CLEAR_TIMER: 'CLEAR_TIMER',
  GET_TIMER: 'GET_TIMER',
  SET_GOAL: 'SET_GOAL',
  ADD_GOAL: 'ADD_TO_GOAL',
  REMOVE_GOAL: 'REMOVE_FROM_GOAL',
  FORCED_PAUSE: 'FORCED_PAUSE',
  WEEK_CLOSE_PAUSE: 'WEEK_CLOSE_PAUSE',
  ACK_FORCED: 'ACK_FORCED',
  START_CHIME: 'START_CHIME',
  HEARTBEAT: 'ping',
};

const MAX_HOURS = 5;
const MIN_MINS = 1;

const HOURS_TO_MS = 60 * 60 * 1000;

const updatedTimeSinceStart = (client) => {
  if (!client.started) return client.goal;
  const now = moment.utc();
  const startAt = moment(client.startAt);
  const timePassed = moment.duration(now.diff(startAt)).asMilliseconds();
  const updatedTime = client.time - timePassed;
  return updatedTime > 0 ? updatedTime : 0;
};

const logTimelogEvent = async (userId, eventType) => {
  try {
    // Store timestamp in UTC only - timezone conversion happens on frontend
    await TimelogTracking.create({
      userId,
      eventType,
      timestamp: new Date(), // UTC timestamp
    });
  } catch (error) {
    logger.logException(error);
    // Don't throw error to avoid breaking timer functionality
  }
};

const startTimer = async (client) => {
  client.startAt = moment.utc();
  client.paused = false;
  if (!client.started) {
    client.started = true;
    client.time = client.goal;
  }
  if (client.forcedPause) client.forcedPause = false;

  // Log the timelog resumed event
  await logTimelogEvent(client.userId, 'Timelog Resumed');
};

const pauseTimer = async (client, forced = false) => {
  if (client.paused) return;

  client.time = updatedTimeSinceStart(client);
  if (client.time === 0) client.chiming = true;
  client.startAt = moment.invalid(); // invalid can not be saved in database
  client.paused = true;
  if (forced) client.forcedPause = true;

  // Log the appropriate pause event
  const eventType = forced ? 'Automatic Pause' : 'Timelog Paused';
  await logTimelogEvent(client.userId, eventType);
};

const startChime = (client, msg) => {
  const state = msg.value;
  client.chiming = state === true;
};

const ackForcedPause = (client) => {
  client.forcedPause = false;
  client.paused = true;
  client.startAt = moment.invalid();
};

const stopTimer = async (client) => {
  if (client.started) await pauseTimer(client);
  client.startAt = moment.invalid();
  client.started = false;
  client.pause = false;
  client.forcedPause = false;
  if (client.chiming) client.chiming = false;
  if (client.time === 0) {
    client.goal = client.initialGoal;
    client.time = client.goal;
  } else {
    client.goal = client.time;
  }

  // Log the time logged event
  await logTimelogEvent(client.userId, 'Time Logged');
};

const clearTimer = (client) => {
  stopTimer(client);
  client.goal = client.initialGoal;
  client.chiming = false;
  client.time = client.goal;
};

const setGoal = (client, msg) => {
  const newGoal = parseInt(msg.value);
  client.goal = newGoal;
  client.time = newGoal;
  client.initialGoal = newGoal;
};

const addGoal = (client, msg) => {
  const duration = parseInt(msg.value);
  const goalAfterAddition = moment.duration(client.goal).add(duration, 'milliseconds').asHours();

  if (goalAfterAddition >= MAX_HOURS) {
    const oldGoal = client.goal;
    client.goal = MAX_HOURS * HOURS_TO_MS;
    client.time = moment
      .duration(client.time)
      .add(client.goal - oldGoal, 'milliseconds')
      .asMilliseconds()
      .toFixed();

    return;
  }

  client.goal = moment
    .duration(client.goal)
    .add(duration, 'milliseconds')
    .asMilliseconds()
    .toFixed();
  client.time = moment
    .duration(client.time)
    .add(duration, 'milliseconds')
    .asMilliseconds()
    .toFixed();
};

const removeGoal = (client, msg) => {
  const duration = parseInt(msg.value);
  const goalAfterRemoval = moment
    .duration(client.goal)
    .subtract(duration, 'milliseconds')
    .asMinutes();
  const timeAfterRemoval = moment
    .duration(client.time)
    .subtract(duration, 'milliseconds')
    .asMinutes();

  if (goalAfterRemoval < MIN_MINS || timeAfterRemoval < 0) return;

  client.goal = moment
    .duration(client.goal)
    .subtract(duration, 'milliseconds')
    .asMilliseconds()
    .toFixed();
  client.time = moment
    .duration(client.time)
    .subtract(duration, 'milliseconds')
    .asMilliseconds()
    .toFixed();
};

const handleMessage = async (msg, clients, userId) => {
  // if (!clients.has(userId)) {
  //   throw new Error('It should have this user in memory');
  // }

  const client = await getClient(clients, userId);
  let resp = null;
  let timelogEvent = null; // Track if a timelog event was created

  switch (msg.action) {
    case action.START_TIMER:
      await startTimer(client);
      timelogEvent = { eventType: 'Timelog Resumed', timestamp: new Date() };
      break;
    case action.GET_TIMER:
      resp = client;
      break;
    case action.SET_GOAL:
      setGoal(client, msg);
      break;
    case action.ADD_GOAL:
      addGoal(client, msg);
      break;
    case action.REMOVE_GOAL:
      removeGoal(client, msg);
      break;
    case action.START_CHIME:
      startChime(client, msg);
      break;
    case action.PAUSE_TIMER:
      await pauseTimer(client);
      timelogEvent = { eventType: 'Timelog Paused', timestamp: new Date() };
      break;
    case action.FORCED_PAUSE:
      await pauseTimer(client, true);
      timelogEvent = { eventType: 'Automatic Pause', timestamp: new Date() };
      break;
    case action.WEEK_CLOSE_PAUSE:
      pauseTimer(client);
      break;
    case action.ACK_FORCED:
      ackForcedPause(client);
      break;
    case action.CLEAR_TIMER:
      await clearTimer(client);
      break;
    case action.STOP_TIMER:
      await stopTimer(client);
      timelogEvent = { eventType: 'Time Logged', timestamp: new Date() };
      break;
    default:
      resp = {
        ...client,
        error: `Unknown operation ${msg.action}, please use one from { ${Object.values(action).join(', ')} }`,
      };
      break;
  }

  saveClient(client);
  clients.set(userId, client);
  if (resp === null) resp = client;

  // Return both the timer response and any timelog event
  return {
    timerResponse: JSON.stringify(resp),
    timelogEvent: timelogEvent ? { ...timelogEvent, userId } : null,
  };
};

module.exports = {
  getClient,
  handleMessage,
  action,
  MAX_HOURS,
  MIN_MINS,
  saveClient,
  updatedTimeSinceStart,
};
