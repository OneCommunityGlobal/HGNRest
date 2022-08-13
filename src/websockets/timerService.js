/* eslint-disable consistent-return */
/* eslint-disable linebreak-style */
const Timer = require('../models/timer');
const timerService = require('./index');

const saveTimerDataToDatabase = async ({ userId, seconds, isWorking }) => {
  // eslint-disable-next-line no-unused-expressions
  timerService?.log({
    message: `Single message being sent to Client (${JSON.stringify({ userId })})\n is saving to the database = \n ${JSON.stringify({ seconds, isWorking })}`,
    type: 'INFO',
  });
  const update = {
    $set: {
      pausedAt: seconds,
      isWorking,
      started: Date.now(),
      lastAccess: Date.now(),
    },
  };

  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    rawResult: true,
  };

  Timer.findOneAndUpdate({ userId }, update, options, (error, rawResult) => {
    if (error) {
      throw new Error('Error updating to database');
    }

    if (
      rawResult === null
      || rawResult.value === undefined
      || rawResult.value === null
      || rawResult.lastErrorObject === null
      || rawResult.lastErrorObject === undefined
      || rawResult.value.length === 0
    ) {
      throw new Error('Update/Upsert timer date failed');
    }

    if (rawResult.lastErrorObject.updatedExisting === true) {
      return 200;
    }
    if (
      rawResult.lastErrorObject.updatedExisting === false
      && rawResult.lastErrorObject.upserted !== undefined
      && rawResult.lastErrorObject.upserted !== null
    ) {
      return 200;
    }
    throw new Error('Update/Upsert timer date failed');
  });
};

export default async () => {
  try {
    const activeTimers = await Timer.find({ isWorking: true }).exec();
    const mapOfActiveTimers = new Map();

    const addTimerByUserId = async (userId) => {
      try {
        if (!mapOfActiveTimers.get(userId)) {
          const userObject = await Timer.findOne({ userId }).exec();
          mapOfActiveTimers.set(userId, {
            isRunning: false,
            seconds: userObject?.pausedAt ?? 0,
            isUserPaused: false,
            userId,
            startedAtInSeconds: 0,
          });

          return mapOfActiveTimers.get(userId);
        }
      } catch (e) {
        console.error(e);
        throw new Error(
          'Major error trying to retrieve exist and creating new WS entry',
        );
      }
    };


    const findOrCreateTimerObject = async (userId) => {
      let timerObject = mapOfActiveTimers.get(userId);

      if (!timerObject?.userId) {
        timerObject = await addTimerByUserId(userId);
      }

      return timerObject;
    };

    /**
     * Initialize timer objects and data
     */
    activeTimers.forEach(timerRecord => mapOfActiveTimers.set(`${timerRecord?.userId}`, {
      isRunning: true,
      isUserPaused: false,
      isApplicationPaused: false,
      seconds: timerRecord?.pausedAt ?? 0,
      userId: timerRecord?.userId,
      startedAtInSeconds: 0,
    }));


    const startTimerByUserId = async (userId, { restartTimerWithSync = false } = {}) => {
      try {
        // Retrieve timer
        const timerObject = await findOrCreateTimerObject(userId);
        const { isApplicationPaused } = timerObject;

        // Calculate initial start of timer
        const UTCTimestampInSeconds = new Date().getTime() / 1000;

        // If timer is paused in memory, and we should return the unpaused timer. Don't save to database
        if (isApplicationPaused && restartTimerWithSync) {
          // Unpause timer in memory
          const unpausedUserTimerData = {
            ...timerObject, startedAtInSeconds: +UTCTimestampInSeconds, isApplicationPaused: false, isUserPaused: false, isRunning: true,
          };

          // Set memory timer to be unpaused
          mapOfActiveTimers.set(unpausedUserTimerData);

          // return object
          return unpausedUserTimerData;
        }

        const newTimerObject = {
          ...timerObject,
          startedAtInSeconds: +UTCTimestampInSeconds,
          isUserPaused: false,
          isApplicationPaused: false,
          isRunning: true,
        };

        // Save timer to database
        await saveTimerDataToDatabase({
          userId,
          seconds: timerObject?.seconds,
          isWorking: true,
        });

        mapOfActiveTimers.set(userId, newTimerObject);

        return newTimerObject;
      } catch (e) {
        console.error(e);
        throw new Error('Unable to start timer');
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
    const getTimerByUserId = async (userId) => {
      try {
        // Retrieve timer from memory or create a new one from database
        const timerObject = await findOrCreateTimerObject(userId);

        return timerObject;
      } catch (e) {
        console.error(e);
        throw new Error('Unable to get timer');
      }
    };

    const pauseTimerByUserId = async (userId, { isUserPaused = true, isApplicationPaused = false, saveDataToDatabase = false }) => {
      try {
        const timerObject = mapOfActiveTimers.get(userId);

        const currentTimeInSeonds = new Date().getTime() / 1000;
        const totalTime = currentTimeInSeonds
          - timerObject?.startedAtInSeconds
          + timerObject?.seconds;

        const newTimerObject = {
          ...timerObject,
          isRunning: false,
          isUserPaused,
          isApplicationPaused,
          seconds: totalTime,
        };

        if (saveDataToDatabase) {
          await saveTimerDataToDatabase({
            userId,
            seconds: totalTime,
            isWorking: false,
          });

          mapOfActiveTimers.delete(userId);
        } else {
          mapOfActiveTimers.set(userId, newTimerObject);
        }


        return newTimerObject;
      } catch (e) {
        console.error(e);
        throw new Error('Unable to pause timer');
      }
    };

    const removeTimerByUserId = async (userId) => {
      try {
        const timerObject = mapOfActiveTimers.get(userId);

        const newTimerObject = {
          ...timerObject,
          isUserPaused: false,
          isApplicationPaused: false,
          isRunning: false,
          seconds: 0,
        };

        await saveTimerDataToDatabase({
          userId,
          seconds: 0,
          isWorking: false,
        });

        mapOfActiveTimers.delete(userId);

        return newTimerObject;
      } catch (e) {
        console.error(e);
        throw new Error('Unable to remove user from map');
      }
    };

    return {
      startTimerByUserId,
      pauseTimerByUserId,
      removeTimerByUserId,
      getTimerByUserId,
    };
  } catch (e) {
    console.error(e);
    throw new Error('Unable to initiate database');
  }
};
