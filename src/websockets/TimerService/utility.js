import { TIMER_UPDATES_CHANNEL } from 'websockets/api';

const logger = require('../../startup/logger');

export const calculateTotalSecondsBasedOnStartingTime = ({ currentTimeInSeconds, startedAtInSeconds, seconds }) => currentTimeInSeconds
          - startedAtInSeconds
  + seconds;

export const getTimerFromRedis = async ({
  userId,
  redisClient,
} = {}) => {
  try {
    return JSON.parse(await redisClient.get(userId) ?? '{}');
  } catch (e) {
    logger.logException(e);
    throw e;
  }
};

export const saveTimerToRedis = ({
  userId,
  redisClient,
  timerObject,
} = {}) => {
  try {
    return redisClient.set(userId, JSON.stringify(timerObject));
  } catch (e) {
      console.log(e);
    logger.logException(e);
    throw e;
  }
};

 export const deleteTimerFromRedis = ({
  userId,
  redisClient,
} = {}) => {
  try {
    return redisClient.del(userId);
  } catch (e) {
    logger.logException(e);
    throw e;
  }
};

 export const publish = ({
  userId,
  timerObject,
  redisClient,
} = {}) => {
    try {
    return redisClient.publish(
      TIMER_UPDATES_CHANNEL,
      JSON.stringify({
        userId,
        timerObject,
      }),
    );
  } catch (e) {
    logger.logException(e);
    throw e;
  }
};
