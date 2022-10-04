const jwt = require('jsonwebtoken');
const moment = require('moment');
const { createClient } = require('redis');
const config = require('../config');
const logger = require('../startup/logger');

export const getUserConnectionKey = userId => `${userId}-connections`;

export const TIMER_UPDATES_CHANNEL = 'timer-service-updates';

export const redisClients = {
  main: createClient({
    url: process.env.REDIS_APP_URL,
  }),
  publisher: createClient({
    url: process.env.REDIS_APP_URL,
  }),
  subscriber: createClient({
    url: process.env.REDIS_APP_URL,
  }),
};

const intents = {
    START_TIMER: 'START_TIMER',
    PAUSE_TIMER: 'PAUSE_TIMER',
    STOP_TIMER: 'STOP_TIMER',
    GET_TIMER: 'GET_TIMER',
};

export const updateClientsList = ({
  clients,
  userId,
  connectionKey,
  websocketConnection,
} = {}) => {
  if (clients?.[userId]) {
    clients[userId] = [
      ...clients[userId],
      { id: connectionKey, websocketConnection },
    ];
  } else {
    clients[userId] = [{ id: connectionKey, websocketConnection }];
  }

  return clients;
};

export const sendMessage = ({ messageToSend, websocketConnection } = {}) => {
  const timeStamp = new Date().getTime() / 1000;

  websocketConnection.send(JSON.stringify({ ...messageToSend, timeStamp }));
};

export const distributeMessages = ({ userId, clients, timerObject }) => {
  if (!clients?.[userId]?.length) {
    return;
  }

  const timeStamp = new Date().getTime() / 1000;

  // eslint-disable-next-line no-unused-expressions
  clients?.[userId]?.forEach(({ websocketConnection }) => websocketConnection.send(JSON.stringify({ ...timerObject, timeStamp })));
};

export const authenticate = (request, returnToRequestFlow) => {
  const authToken = request.headers?.['sec-websocket-protocol'];
  let payload = '';
  try {
    payload = jwt.verify(authToken, config.JWT_SECRET);
  } catch (error) {
    returnToRequestFlow('401 Unauthorized', null);
  }

  if (
    !payload
    || !payload.expiryTimestamp
    || !payload.userid
    || !payload.role
    || moment().isAfter(payload.expiryTimestamp)
  ) {
    returnToRequestFlow('401 Unauthorized', null);
  }

  returnToRequestFlow(null, payload.userid);
};

// Handle Message Callback
export async function handleMessage(data, { timerService, userId, websocketConnection }) {
  try {
        const intentData = JSON.parse(data?.toString()) ?? {};
        const {
            intent,
            isUserPaused,
            restartTimerWithSync,
            saveTimerData,
            isApplicationPaused,
        } = intentData;

        switch (intent) {
            case intents.START_TIMER:
                await timerService.startTimerByUserId(userId, {
                    restartTimerWithSync,
                    redisClients,
                });
                break;
            case intents.GET_TIMER:
                sendMessage({
                    websocketConnection,
                    messageToSend: await timerService.getTimerByUserId(userId, { redisClients }),
                });
                break;
            case intents.PAUSE_TIMER:
                await timerService.pauseTimerByUserId(userId, {
                    isUserPaused,
                    saveTimerData,
                    isApplicationPaused,
                    redisClients,
                });
                break;
            case intents.STOP_TIMER:
                await timerService.removeTimerByUserId(userId, { redisClients });
                break;
        default:
            sendMessage({
                websocketConnection,
                messageToSend: 'Please enter a valid intent',
            });
        }
    } catch (e) {
        logger.logException(e);
        sendMessage({
            websocketConnection,
            messageToSend: 'Something went wrong, try again',
        });
    }
}


export async function handleClose({
 clients, userId, interval, timerService, websocketConnection,
}) {
    try {
        clearInterval(interval);

        const activeTimer = JSON.parse(await redisClients.main.get(userId) ?? '{}');

        const userConnections = await redisClients.main.get(getUserConnectionKey(userId));

        const currentUserConnections = +userConnections - 1;
        await redisClients.main.set(getUserConnectionKey(userId), currentUserConnections);

        clients[userId] = clients[userId].filter(
            ({ id }) => id !== websocketConnection.id,
        );

        if (currentUserConnections < 1 && activeTimer?.userId) {
            await timerService.pauseTimerByUserId(userId, {
              saveDataToDatabase: true,
              isUserPaused: activeTimer?.isUserPaused,
              isApplicationPaused: !activeTimer?.isUserPaused,
              redisClients,
            });
        }

        if (currentUserConnections < 1 || +userConnections === 0) {
          await redisClients.main.del(getUserConnectionKey(userId));
        }
    } catch (e) {
        logger.logException(e);
        sendMessage({
            websocketConnection,
            messageToSend: 'Something went wrong, try again',
        });
    }
}

export async function listener(message, { clients }) {
  const { userId, timerObject } = JSON.parse(message) ?? {};
  distributeMessages({ clients, userId, timerObject });
}

export const syncRedisDatabaseOnShutDown = async (callback, { clients, redisPassedInClients, timerService }) => {
  /**
   * We need to loop through all active clients and make sure
   * that they are cleaned up in the Redis database and update
   * the correct number of connections
   */
  const cleanupArray = Object.keys(clients).map(userIdProperty => new Promise(async (resolve, reject) => {
    try {
        const userConnections = await redisPassedInClients.main.get(getUserConnectionKey(userIdProperty));

        const currentUserConnections = +userConnections - clients[userIdProperty].length;
        await redisPassedInClients.main.set(getUserConnectionKey(userIdProperty), currentUserConnections);

      if (currentUserConnections === 0) {
          await timerService.pauseTimerByUserId(userIdProperty, {
            saveDataToDatabase: true,
            isUserPaused: true,
            isApplicationPaused: false,
            redisClients: redisPassedInClients,
          });

          redisPassedInClients.main.del(getUserConnectionKey(userIdProperty));
        }

      resolve('Done!');
    } catch (e) {
      reject(e);
   }
 }), []);

 /**
  * Wait for all users to be properly be disconnected when shutting down
  */
 await Promise.all(cleanupArray);

  callback();
};
