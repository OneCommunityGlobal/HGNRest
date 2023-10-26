/* eslint-disable no-multi-assign */
/* eslint-disable radix */
const moment = require('moment');
const Timer = require('../../models/timer');
const logger = require('../../startup/logger');

export const getClient = async (clients, userId) => {
  // In case of there is already a connection that is open for this user
  // for example user open a new connection
  if (!clients.has(userId)) {
    try {
      let timer = await Timer.findOne({ userId });
      if (!timer) timer = await Timer.create({ userId });
      clients.set(userId, timer);
    } catch (e) {
      logger.logException(e);
      throw new Error(
        'Something happened when trying to retrieve timer from mongo',
      );
    }
  }
  return clients.get(userId);
};

export const saveClient = async (client) => {
  try {
    await Timer.findOneAndUpdate({ userId: client.userId }, client);
  } catch (e) {
    logger.logException(e);
    throw new Error(
      `Something happened when trying to save user timer to mongo, Error: ${e}`,
    );
  }
};

export const action = {
  START_TIMER: 'START_TIMER',
  PAUSE_TIMER: 'PAUSE_TIMER',
  STOP_TIMER: 'STOP_TIMER',
  CLEAR_TIMER: 'CLEAR_TIMER',
  SET_GOAL: 'SET_GOAL=',
  ADD_GOAL: 'ADD_TO_GOAL=',
  REMOVE_GOAL: 'REMOVE_FROM_GOAL=',
  FORCED_PAUSE: 'FORCED_PAUSE',
  ACK_FORCED: 'ACK_FORCED',
};

const MAX_HOURS = 5;
const MIN_MINS = 1;

const updatedTimeSinceStart = (client) => {
  if (!client.started) return client.goal;
  const now = moment.utc();
  const startAt = moment(client.startAt);
  const timePassed = moment.duration(now.diff(startAt)).asMilliseconds();
  const updatedTime = client.time - timePassed;
  return updatedTime > 0 ? updatedTime : 0;
};

const startTimer = (client) => {
  client.startAt = moment.utc();
  client.paused = false;
  if (!client.started) {
    client.started = true;
    client.time = client.goal;
  }
  if (client.forcedPause) client.forcedPause = false;
};

const pauseTimer = (client, forced = false) => {
  client.time = updatedTimeSinceStart(client);
  client.startAt = moment.invalid(); // invalid can not be saved in database
  client.paused = true;
  if (forced) client.forcedPause = true;
};

const ackForcedPause = (client) => {
  client.forcedPause = false;
  client.paused = true;
  client.startAt = moment.invalid();
};

const stopTimer = (client) => {
  client.startAt = moment.invalid();
  client.started = false;
  client.pause = false;
  client.forcedPause = false;
};

const clearTimer = (client) => {
  stopTimer(client);
  client.time = client.goal;
};

const setGoal = (client, msg) => {
  const newGoal = parseInt(msg.split('=')[1]);
  if (!client.started) {
    client.goal = newGoal;
    client.time = newGoal;
  } else {
    const passedTime = client.goal - client.time;
    if (passedTime >= newGoal) {
      client.time = 0;
      client.goal = passedTime;
    } else {
      client.time = newGoal - passedTime;
      client.goal = newGoal;
    }
  }
};

const addGoal = (client, msg) => {
  const duration = parseInt(msg.split('=')[1]);
  const goalAfterAddition = moment
    .duration(client.goal)
    .add(duration, 'milliseconds')
    .asHours();

  if (goalAfterAddition > MAX_HOURS) return;

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
  const duration = parseInt(msg.split('=')[1]);
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

export const handleMessage = async (msg, clients, userId) => {
  if (!clients.has(userId)) {
    throw new Error('It should have this user in memory');
  }

  const client = clients.get(userId);
  let resp = null;

  const req = msg.toString();
  switch (req) {
    case action.START_TIMER:
      startTimer(client);
      break;
    case req.match(/SET_GOAL=/i)?.input:
      setGoal(client, req);
      break;
    case req.match(/ADD_TO_GOAL=/i)?.input:
      addGoal(client, req);
      break;
    case req.match(/REMOVE_FROM_GOAL=/i)?.input:
      removeGoal(client, req);
      break;
    case action.PAUSE_TIMER:
      pauseTimer(client);
      break;
    case action.FORCED_PAUSE:
      pauseTimer(client, true);
      break;
    case action.ACK_FORCED:
      ackForcedPause(client);
      break;
    case action.CLEAR_TIMER:
      clearTimer(client);
      break;
    case action.STOP_TIMER:
      stopTimer(client);
      break;

    default:
      resp = {
        ...client,
        error: `Unknown operation ${req}, please use one of ${action}`,
      };
      break;
  }

  saveClient(client);
  clients.set(userId, client);
  if (resp === null) resp = client;
  return JSON.stringify(resp);
};
