const moment = require("moment");
const Timer = require("../../models/timer");
const logger = require("../../startup/logger");

/*
This is the contract between client and server.
The client can send one of the following messages to the server:
*/
export const action = {
  START_TIMER: "START_TIMER",
  PAUSE_TIMER: "PAUSE_TIMER",
  STOP_TIMER: "STOP_TIMER",
  GET_TIMER: "GET_TIMER",
  CLEAR_TIMER: "CLEAR_TIMER",
  SWITCH_MODE: "SWITCH_MODE",
  SET_GOAL: "SET_GOAL=",
  ADD_GOAL: "ADD_GOAL=",
  REMOVE_GOAL: "REMOVE_GOAL=",
  FORCED_PAUSE: "FORCED_PAUSE",
  ACK_FORCED: "ACK_FORCED",
};

/*
Here we get the total elapsed time since the last access.
Since we have two modes for the timer, countdown and stopwatch,
we need to know which one is active to calculate the total elapsed time.
If the timer is in countdown mode, we need to subtract the elapsed time from the total time.
if this total time is less than 0, we set it to 0.
If the timer is in stopwatch mode,
we need to add the elapsed time since the last access to the total time.
we then return the total
*/
const getTotalElapsedTime = (client) => {
  const now = moment();
  const lastAccess = moment(client.lastAccess);
  const elapSinceLastAccess = moment.duration(now.diff(lastAccess));
  const time = moment.duration(moment(client.time));

  let total;
  if (client.countdown) {
    total = time.subtract(elapSinceLastAccess, "milliseconds");
    if (total.asMilliseconds() < 0) {
      total = moment.duration(0);
    }
  } else total = elapSinceLastAccess.add(client.time, "milliseconds");

  return total;
};

/*
Here we start the timer, if it is not already started.
We set the last access time to now, and set the paused and stopped flags to false.
If the timer was paused, we need to check if it was paused by the user or by the server.
If it was paused by the server, we need to set the forcedPause flag to true.
*/
const startTimer = (client) => {
  if (client.paused) {
    client.lastAccess = moment();
    client.stopped = false;
    client.paused = false;
    if (client.forcedPause) client.forcedPause = false;
  }
};

/*
Here we pause the timer, if it is not already paused.
We get the total elapsed time since the last access, and set it as the new time.
We set the last access time to now, and set the paused flag to true.
If the timer was paused by the server, we need to set the forcedPause flag to true.
It'll only be triggered when the user closes the connection sudenlly or lacks of ACKs.
*/
const pauseTimer = (client, forced = false) => {
  if (!client.paused) {
    client.time = getTotalElapsedTime(client).asMilliseconds().toFixed();
    client.lastAccess = moment();
    client.paused = true;
    if (forced) client.forcedPause = true;
  }
};

// Here we acknowledge the forced pause. To prevent the modal for beeing displayed again.
const ackForcedPause = (client) => {
  client.forcedPause = false;
};

/*
Here we clear the timer.
We pause the timer and check it's mode to set the time to 0 or the goal.
Then we set the stopped flag to false.
*/
const clearTimer = (client) => {
  pauseTimer(client);
  client.time = client.countdown ? client.goal : 0;
  client.stopped = false;
};

/*
Here we stop the timer.
We pause the timer and set the stopped flag to true.
*/
const stopTimer = (client) => {
  pauseTimer(client);
  client.stopped = true;
};

/*
Here we switch the timer mode.
We pause the timer and check it's mode to set the time to 0 or the goal.
*/
const switchMode = (client) => {
  client.countdown = !client.countdown;
  client.time = client.countdown ? client.goal : 0;
  client.paused = true;
};

// Here we get the goal time from the message.
const getGoal = (msg) => parseInt(msg.split("=")[1]);

// Here we set the goal and time to the goal time.
const setGoal = (client, msg) => {
  const goal = getGoal(msg);
  client.goal = client.time = goal;
};

const goalOver10Hours = (client, time) => {
  const goal = moment.duration(client.goal).add(time, "milliseconds").asHours();
  return goal > 10;
};

/*
Here we add the goal time.
First we get the goal time from the message.
Then we add it to the current goal time and set it as the new goal time.
We also add it to the current time and set it as the new time.
*/
const addGoal = (client, msg) => {
  const goal = getGoal(msg);
  if (goalOver10Hours(client, goal)) return;

  client.goal = moment
    .duration(client.goal)
    .add(goal, "milliseconds")
    .asMilliseconds()
    .toFixed();
  client.time = moment
    .duration(client.time)
    .add(goal, "milliseconds")
    .asMilliseconds()
    .toFixed();
};

/*
 * Here we check if the goal time is less than 15 minutes.
 * */
const goalLessThan15min = (client, time) => {
  const goal = moment
    .duration(client.goal)
    .subtract(time, "milliseconds")
    .asMinutes();
  return goal < 15;
};

/*
 * Here we try to remove a goal time.
 * First we get the goal time from the message.
 * Then we subtract it from the current goal time and set it as the new goal time.
 * We also subtract it from the current time and set it as the new time.
 * If the new goal time is less than 15 minutes, we don't do anything.
 * If the new time is less than 0, we set it to 0.
 * */
const removeGoal = (client, msg) => {
  const goal = getGoal(msg);
  if (goalLessThan15min(client, goal)) return;

  client.goal = moment
    .duration(client.goal)
    .subtract(goal, "milliseconds")
    .asMilliseconds()
    .toFixed();
  const time = moment
    .duration(client.time)
    .subtract(goal, "milliseconds")
    .asMilliseconds()
    .toFixed();
  client.time = time < 0 ? 0 : time;
};

/*
Here we get the timer.
If the timer already exists in memory, we return it.
If it doesn't exist, we try to get it from MongoDB.
If it doesn't exist in MongoDB, we create it and save it to MongoDB.
Then we save it to memory and return it.
*/
export const getTimer = async (clientsMap, userId) => {
  if (clientsMap.has(userId)) return;

  try {
    let timer = await Timer.findOne({ userId });
    if (!timer) timer = await Timer.create({ userId });
    clientsMap.set(userId, timer);
  } catch (e) {
    logger.logException(e);
    throw new Error(
      "Something happened when trying to retrieve timer from mongo"
    );
  }
};

// Here we just save the timer to MongoDB.
const saveClient = async (client) => {
  try {
    await Timer.findOneAndUpdate({ userId: client.userId }, client);
  } catch (e) {
    logger.logException(e);
    throw new Error(
      "Something happened when trying to save user timer to mongo"
    );
  }
};

/*
Here is were we handle the messages.
First we check if the user is in memory, if not, we throw an error.
Then we parse the request and check which action it is and call the corresponding function.
If we don't have a match, we just return an error.
The only operation that we write to Mongo it's the stop timer. Other operations are just in memory.
So the slowest part of the app is the save to Mongo.
Then we update the current client in hash map and return the response.
*/
export const handleMessage = async (msg, clientsMap, userId) => {
  if (!clientsMap.has(userId)) {
    throw new Error("It should have this user in memory");
  }

  const client = clientsMap.get(userId);
  let resp = null;

  const req = msg.toString();
  switch (req) {
    case action.GET_TIMER:
      break;
    case action.START_TIMER:
      startTimer(client);
      break;
    case action.SWITCH_MODE:
      switchMode(client);
      break;
    case req.match(/SET_GOAL=/i)?.input:
      setGoal(client, req);
      break;
    case req.match(/ADD_GOAL=/i)?.input:
      addGoal(client, req);
      break;
    case req.match(/REMOVE_GOAL=/i)?.input:
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

  if (req === action.STOP_TIMER) {
    await saveClient(client).catch((err) => {
      resp = { ...client, error: err };
    });
  }

  clientsMap.set(userId, client);
  if (resp === null) resp = client;
  return JSON.stringify(resp);
};
