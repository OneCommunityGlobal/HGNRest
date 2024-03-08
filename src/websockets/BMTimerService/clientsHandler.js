/* eslint-disable no-multi-assign */
/* eslint-disable radix */
const moment = require("moment");
const Timer = require("../../models/timer");
const logger = require("../../startup/logger");

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
        "Something happened when trying to retrieve timer from mongo"
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
      `Something happened when trying to save user timer to mongo, Error: ${e}`
    );
  }
};

export const action = {
  START_TIMER: "START_TIMER",
  PAUSE_TIMER: "PAUSE_TIMER",
  STOP_TIMER: "STOP_TIMER",
  CLEAR_TIMER: "CLEAR_TIMER",
};

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
  if (client.time === 0) client.chiming = true;
  client.startAt = moment.invalid(); // invalid can not be saved in database
  client.paused = true;
  if (forced) client.forcedPause = true;
};

const stopTimer = (client) => {
  if (client.started) pauseTimer(client);
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
};

const clearTimer = (client) => {
  stopTimer(client);
  client.goal = client.initialGoal;
  client.chiming = false;
  client.time = client.goal;
};

export const handleMessage = async (msg, clients, userId) => {
  if (!clients.has(userId)) {
    throw new Error("It should have this user in memory");
  }

  const client = clients.get(userId);
  let resp = null;

  const req = msg.toString();
  switch (req) {
    case action.START_TIMER:
      startTimer(client);
      break;
    case action.PAUSE_TIMER:
      pauseTimer(client);
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
