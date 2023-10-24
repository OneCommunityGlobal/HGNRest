/* eslint-disable no-multi-assign */
/* eslint-disable radix */
const moment = require('moment');
const Timer = require('../../models/timer');
const logger = require('../../startup/logger');

/**
 * Here we get the timer.
 * If the timer already exists in memory, we return it.
 * If it doesn't exist, we try to get it from MongoDB.
 * If it doesn't exist in MongoDB, we create it and save it to MongoDB.
 * Then we save it to memory and return it.
 */
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

/**
 * Save client info to database
 * Save under these conditions:
 *  connection is normally closed (paused and closed);
 *  connection is forced-paused (timer still on and connection closed)
 *  message: STOP_TIMER
 */
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

/**
 * This is the contract between client and server.
 * The client can send one of the following messages to the server:
 */
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

/**
 * Here we start the timer, if it is not already started.
 * We set the last access time to now, and set the paused and stopped flags to false.
 * If the timer was paused, we need to check if it was paused by the user or by the server.
 * If it was paused by the server, we need to set the forcedPause flag to true.
 */
const startTimer = (client) => {
  client.startAt = moment.utc();
  client.paused = false;
  if (!client.started) {
    client.started = true;
    client.time = client.goal;
  }
  if (client.forcedPause) client.forcedPause = false;
};

/**
 * Here we pause the timer, if it is not already paused.
 * We get the total elapsed time since the last access, and set it as the new time.
 * We set the last access time to now, and set the paused flag to true.
 * If the timer was paused by the server, we need to set the forcedPause flag to true.
 * It'll only be triggered when the user closes the connection sudenlly or lacks of ACKs.
 */
const pauseTimer = (client, forced = false) => {
  client.time = updatedTimeSinceStart(client);
  client.startAt = moment.invalid();
  client.paused = true;
  if (forced) client.forcedPause = true;
};

// Here we acknowledge the forced pause. To prevent the modal for beeing displayed again.
const ackForcedPause = (client) => {
  client.forcedPause = false;
  client.paused = true;
  client.startAt = moment.invalid();
};

/**
 * Here we stop the timer.
 * We pause the timer and set the stopped flag to true.
 */
const stopTimer = (client) => {
  client.startAt = moment.invalid();
  client.started = false;
  client.pause = false;
  client.forcedPause = false;
};

/**
 * Here we clear the timer.
 * We pause the timer and check it's mode to set the time to 0 or the goal.
 * Then we set the stopped flag to false.
 */
const clearTimer = (client) => {
  stopTimer(client);
  client.goal = moment.duration(2, 'hours').asMilliseconds();
  client.time = client.goal;
};

// Here we set the goal and time to the goal time.
/**
 * Here we set the goal.
 * if timer has not started, we set both time and goal to the new goal
 * if timer has started, we calculate the passed time and remove that from new goal
 * and if passed time is greater than new goal, then set time to 0, but this should
 * not be prohibited by frontend.
 */
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

/**
 * Here we add the goal time.
 * Each addition add 15min
 * First we get the goal time from the message.
 * Then we add it to the current goal time and set it as the new goal time.
 * We also add it to the current time and set it as the new time.
 */
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

/**
 * Here we try to remove a goal time.
 * First we get the goal time from the message.
 * Then we subtract it from the current goal time and set it as the new goal time.
 * We also subtract it from the current time and set it as the new time.
 * If the new goal time is less than 15 minutes, we don't do anything.
 * If the new time is less than 0, we set it to 0.
 */
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


/**
 * Here is were we handle the messages.
 * First we check if the user is in memory, if not, we throw an error.
 * Then we parse the request and check which action it is and call the corresponding function.
 * If we don't have a match, we just return an error.
 * The only operation that we write to Mongo it's the stop timer. Other operations are just in memory.
 * So the slowest part of the app is the save to Mongo.
 * Then we update the current client in hash map and return the response.
 */
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
