/* eslint-disable consistent-return */
/* eslint-disable linebreak-style */
const Timer = require('../../models/timer');
const logger = require('../../startup/logger');
const {
  setTimerToDatabase,
  getTimerFromDatabase,
} = require('../../controllers/timerController')(Timer);
const {
  saveTimerToRedis,
  publish,
  getTimerFromRedis,
  calculateTotalSecondsBasedOnStartingTime,
  deleteTimerFromRedis,
} = require('./utility');

export default async () => {
  try {
    const addTimerByUserId = async (userId, redisClient, startTimer) => {
      try {
        const {
          isUserPaused,
          isRunning,
          isApplicationPaused,
          totalSeconds,
        } = await getTimerFromDatabase({
          userId,
        });

        const timerObject = {
          isUserPaused,
          isRunning,
          isApplicationPaused,
          seconds: totalSeconds ?? 0,
          userId,
          startedAtInSeconds: 0,
        };

        if (startTimer) {
          saveTimerToRedis({
            redisClient,
            userId,
            timerObject,
          });
        }

        return timerObject;
      } catch (e) {
        logger.logException(e);
        throw new Error(
          'Major error trying to retrieve exist and creating new WS entry',
        );
      }
    };

    const findOrCreateTimerObject = async (userId, { redisClient, startTimer }) => {
      try {
        let timerObject = await getTimerFromRedis({
          redisClient,
          userId,
        });
        if (!timerObject?.userId) {
          timerObject = await addTimerByUserId(userId, redisClient, startTimer);
        }

        return timerObject;
      } catch (e) {
        logger.logException(e);
        throw new Error(
          'Major error trying to retrieve existing or create new timer entry',
        );
      }
    };

    const startTimerByUserId = async (
      userId,
      {
        restartTimerWithSync = false,
        redisClients: {
          main,
          publisher,
        } = {},
      } = {},
    ) => {
      try {
        // Retrieve timer
        const timerObject = await findOrCreateTimerObject(userId, { redisClient: main, startTimer: true }) ?? {};
        const {
          isApplicationPaused,
        } = timerObject;

        // Calculate initial start of timer
        const UTCTimestampInSeconds = new Date().getTime() / 1000;

        // If timer is paused in memory, and we should return the unpaused timer. Don't save to database
        if (isApplicationPaused && restartTimerWithSync) {
          // Unpause timer in memory
          const unpausedUserTimerData = {
            ...timerObject,
            startedAtInSeconds: +UTCTimestampInSeconds,
            isApplicationPaused: false,
            isUserPaused: false,
            isRunning: true,
          };

          // Set memory timer to be unpaused
          await saveTimerToRedis({
            userId,
            redisClient: main,
            timerObject: unpausedUserTimerData,
          });

          // Publish to all clients listening
          await publish({
            userId,
            redisClient: publisher,
            timerObject: unpausedUserTimerData,
          });

          // return object
          return;
        }

        const newTimerObject = {
          ...timerObject,
          startedAtInSeconds: +UTCTimestampInSeconds,
          isUserPaused: false,
          isApplicationPaused: false,
          isRunning: true,
        };

        if (newTimerObject?.seconds === 0) {
          // Save timer to mongo database
          await setTimerToDatabase({
            userId,
            timerObject: {
              totalSeconds: newTimerObject.seconds,
              ...timerObject,
            },
          });
        }

        // Save timer to redis
        await saveTimerToRedis({
          userId,
          redisClient: main,
          timerObject: newTimerObject,
        });

        // publish timer to all clients
        await publish({
          userId,
          redisClient: publisher,
          timerObject: newTimerObject,
        });

        return newTimerObject;
      } catch (e) {
        logger.logException(e);
        throw new Error(e);
      }
    };

    /**
     * This function will return a timer object
     * that is active in memory or from database
     *
     * @param {string} userId - The user id associated to the timer
     * @param {object} settings - optional parameters to pass to change behavior.
     * @return {string} A timer object
     */
    const getTimerByUserId = async (userId, {
      redisClients: {
        main,
      },
    }) => {
      try {
        // Retrieve timer from memory or create a new one from database
        const timerObject = await findOrCreateTimerObject(userId, { redisClient: main, startTimer: false });
        return timerObject;
      } catch (e) {
        logger.logException(e);
        throw new Error(e);
      }
    };

    const pauseTimerByUserId = async (
      userId, {
        isUserPaused = true,
        isApplicationPaused = false,
        saveDataToDatabase = false,
        redisClients: {
          main,
          publisher,
        },
      },
    ) => {
      try {
        const timerObject = await getTimerFromRedis({
          redisClient: main,
          userId,
        });

        // Prevent pausing application twice
        if (!timerObject?.isRunning) {
          return timerObject;
        }

        const currentTimeInSeconds = new Date().getTime() / 1000;

        const totalTimeAddedUp = calculateTotalSecondsBasedOnStartingTime({
          currentTimeInSeconds,
          startedAtInSeconds: timerObject?.startedAtInSeconds,
          seconds: timerObject?.seconds,
        });

        const newTimerObject = {
          ...timerObject,
          isRunning: false,
          isUserPaused,
          isApplicationPaused,
          seconds: totalTimeAddedUp,
        };

        /**
         * Mongo Saving
         *
         * We would like to clean up here
         * when we are saving persistent timer
         * data. We only save when the user is
         * logging out or all active connections have
         * severed.
         */
        if (saveDataToDatabase) {
          await setTimerToDatabase({
            userId,
            timerObject: {
              // We use previous data since this is the correct time here
              totalSeconds: totalTimeAddedUp,
              ...newTimerObject,
            },
          });

          await deleteTimerFromRedis({
            userId,
            redisClient: main,
          });
        } else {
          // Resync timer to redis
          await saveTimerToRedis({
            userId,
            redisClient: main,
            timerObject: newTimerObject,
          });

          // publish to all listening clients
          await publish({
            userId,
            redisClient: publisher,
            timerObject: newTimerObject,
          });
        }

        return;
      } catch (e) {
        logger.logException(e);
      }
    };

    const removeTimerByUserId = async (
      userId, {
        redisClients: {
          main,
          publisher,
        },
      },
    ) => {
      try {
        const timerObject = await getTimerFromRedis({
          redisClient: main,
          userId,
        });

        const newTimerObject = {
          ...timerObject,
          isUserPaused: false,
          isApplicationPaused: false,
          isRunning: false,
          seconds: 0,
        };

        await setTimerToDatabase({
          userId,
          timerObject: {
            totalSeconds: 0,
            isRunning: false,
            isUserPaused: false,
            isApplicationPaused: false,
          },
        });

        await publish({
          userId,
          redisClient: publisher,
          timerObject: newTimerObject,
        });
        await deleteTimerFromRedis({
          userId,
          redisClient: main,
        });

        return;
      } catch (e) {
        logger.logException(e);
      }
    };

    return {
      startTimerByUserId,
      pauseTimerByUserId,
      removeTimerByUserId,
      getTimerByUserId,
    };
  } catch (e) {
    logger.logException(e);
    throw new Error('Unable to initiate database');
  }
};
