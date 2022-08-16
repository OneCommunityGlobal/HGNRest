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

export const intents = {
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
  websocketConnection.send(JSON.stringify(messageToSend));
};

export const distrubuteMessage = ({ userId, clients, timerObject }) => {
  clients[userId].map(({ websocketConnection }) => websocketConnection.send(JSON.stringify(timerObject)));
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

        console.log('Closing connection, ', { userId });
        const activeTimer = JSON.parse(await redisClients.main.get(userId) ?? {});
        console.log('Closing connection, ', { userId, activeTimer });
        const userConnections = await redisClients.main.get(getUserConnectionKey(userId));
        console.log('Removing connection from redis, Before -->', { userId, userConnections });
        const currentUserConnections = +userConnections - 1;
        await redisClients.main.set(getUserConnectionKey(userId), currentUserConnections);
        console.log('Removing connection from redis, After -->', { userId, userConnections: currentUserConnections });

        console.log('\nRemoving connection from websocket list, Before -->', { userId, totalConnections: clients?.[userId]?.length });


        clients[userId] = clients[userId].filter(
            ({ connectionKey: activeConnectionKey }) => activeConnectionKey === websocketConnection.id,
        );

        console.log('Removing connection from websocket list, After -->', { userId, totalConnections: clients?.[userId]?.length });


        if (currentUserConnections < 1 && activeTimer?.isRunning) {
            console.log('Saving data, since there is no more active connections');
            await timerService.pauseTimerByUserId(userId, {
            saveDataToDatabase: true,
            isUserPaused: false,
            isApplicationPaused: true,
            redisClients,
            });

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
    distrubuteMessage({ clients, userId, timerObject });
}
