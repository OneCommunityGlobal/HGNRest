/* eslint-disable no-restricted-syntax */
/* eslint-disable operator-linebreak */
/* eslint-disable consistent-return */
/* eslint-disable quotes */

/* eslint-disable linebreak-style */
const WebSocket = require('ws');
const moment = require('moment');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../startup/logger');

const {
  insertNewUser,
  removeConnection,
  broadcastToSameUser,
  hasOtherConn,
} = require('./TimerService/connectionsHandler');

const { getClient, handleMessage, action } = require('./TimerService/clientsHandler');

/**
 * Here we authenticate the user.
 * We get the token from the headers and try to verify it.
 * If it fails, we throw an error.
 * Else we check if the token is valid and if it is, we return the user id.
 */
const authenticate = (req, res) => {
  const authToken = req.headers?.['sec-websocket-protocol'];

  if (!authToken) {
    res('401 Unauthorized', null);
    return;
  }

  let payload = '';
  try {
    payload = jwt.verify(authToken, config.JWT_SECRET);
    res(null, payload.userid);
  } catch (error) {
    res('401 Unauthorized', null);
  }
};

/**
 * Here we start the timer service.
 * First we create a map to store the clients and start the Websockets Server.
 * Then we set the upgrade event listener to the Express Server, authenticate the user and
 * if it is valid, we add the user id to the request and handle the upgrade and emit the connection event.
 */
export default () => {
  const wss = new WebSocket.Server({
    noServer: true,
  });

  const handleUpgrade = (request, socket, head) => {
    authenticate(request, (err, client) => {
      if (err || !client) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      request.userId = client;
      wss.handleUpgrade(request, socket, head, (websocket) => {
        wss.emit('connection', websocket, request);
      });
    });
  };

  const clients = new Map(); // { userId: timerInfo }
  const connections = new Map(); // { userId: connections[] }

  wss.on('connection', async (ws, req) => {
    ws.isAlive = true;
    const { userId } = req;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    insertNewUser(connections, userId, ws);

    /**
     * Here we get the timer from memory or from the database and send it to the client.
     */
    const clientTimer = await getClient(clients, userId);
    ws.send(JSON.stringify(clientTimer));

    /**
     * Here we handle the messages from the client.
     * And we broadcast the response to all the clients that are connected to the same user.
     */
    ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.action === action.HEARTBEAT) {
        ws.send(JSON.stringify({ heartbeat: 'pong' }));
        return;
      }
      const result = await handleMessage(msg, clients, msg.userId ?? userId);
      broadcastToSameUser(connections, userId, result.timerResponse);
      if (result.timelogEvent) {
        const timelogEventMessage = JSON.stringify({
          type: 'TIMELOG_EVENT',
          data: result.timelogEvent,
        });
        broadcastToSameUser(connections, userId, timelogEventMessage);
      }
    });

    /**
     * Here we handle the close event.
     * If there is another connection to the same user, we don't do anything.
     * Else he is the last connection and we do a forced pause if need be.
     * This may happen if the user closes all the tabs or the browser or he lost connection with
     * the service
     * We then remove the connection from the connections map.
     */
    ws.on('close', async () => {
      if (!hasOtherConn(connections, userId, ws)) {
        const client = clients.get(userId);
        if (client.started && !client.paused) {
          await handleMessage({ action: action.FORCED_PAUSE }, clients, userId);
        }
      }
      removeConnection(connections, userId, ws);
    });
  });

  // For each new connection we start a time interval of 1min to check if the connection is alive.
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.close();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 60000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  /**
   * Scheduled forced pause triggers using the same mechanism as disconnect
   * - Weekly at week end (Sunday 12:01 AM PT)
   * - Daily at 12:30 PM PT
   */
  const scheduleForcedPauses = () => {
    // Weekly: Saturday 11:58 PM PT
    cron.schedule(
      '58 23 * * 6',
      async () => {
        try {
          const now = moment().format();
          logger.logInfo(`[WS] Weekly pause trigger at ${now} PT`);
          for (const [userId, client] of clients.entries()) {
            try {
              if (client?.started && !client?.paused) {
                logger.logInfo(`[WS] Sending weekly pause to user ${userId} (weekly)`);
                await handleMessage({ action: action.WEEK_CLOSE_PAUSE }, clients, userId);
                broadcastToSameUser(
                  connections,
                  userId,
                  JSON.stringify({ action: action.WEEK_CLOSE_PAUSE }),
                );
              }
            } catch (err) {
              logger.logException(`[WS] Weekly pause error for user ${userId}: ${err}`);
            }
          }
        } catch (err) {
          logger.logException(`[WS] Weekly pause scheduler error: ${err}`);
        }
      },
      { timezone: 'America/Los_Angeles' },
    );

    // ============================================================================
    // TESTING WEEK END TIMER BEHAVIOR
    // ============================================================================
    // TO TEST: Uncomment the cron.schedule block below (lines 212-238)
    // CRON FORMAT: 'minute hour day-of-month month day-of-week'
    //
    // TESTING EXAMPLES (all times converted to PT for America/Los_Angeles timezone):
    //
    // 1. TEST AT SPECIFIC TIMES:
    //    '0 9 * * *'   = 9:00 AM PT
    //    '30 12 * * *' = 12:30 PM PT
    //    '15 17 * * *' = 5:15 PM PT
    //    '45 23 * * *' = 11:45 PM PT
    //
    // 2. TIMEZONE CONVERSION EXAMPLES:
    //    For Eastern Time (ET) users:
    //    - 10:00 AM ET = 7:00 AM PT → use '0 7 * * *'
    //    - 2:00 PM ET = 11:00 AM PT → use '0 11 * * *'
    //    - 6:00 PM ET = 3:00 PM PT → use '0 15 * * *'
    //
    //    For Central Time (CT) users:
    //    - 10:00 AM CT = 8:00 AM PT → use '0 8 * * *'
    //    - 2:00 PM CT = 12:00 PM PT → use '0 12 * * *'
    //    - 6:00 PM CT = 4:00 PM PT → use '0 16 * * *'
    //
    //    For Mountain Time (MT) users:
    //    - 10:00 AM MT = 9:00 AM PT → use '0 9 * * *'
    //    - 2:00 PM MT = 1:00 PM PT → use '0 13 * * *'
    //    - 6:00 PM MT = 5:00 PM PT → use '0 17 * * *'
    //
    // IMPORTANT NOTES:
    // - Always keep timezone: 'America/Los_Angeles' (PT/PDT)
    // - Convert your local time to PT before setting the cron
    // - Use 24-hour format for hours (0-23)
    // - Test with a timer running to see the pause effect
    // - Check server logs for confirmation: "[WS] Daily pause trigger at..."
    // ============================================================================

    // Uncomment the cron.schedule block below to test
    // cron.schedule(
    //   '47 14 * * *', // only modify this line
    //   async () => {
    //     try {
    //       const now = moment().format();
    //       logger.logInfo(`[WS] Daily pause trigger at ${now} PT`);
    //       for (const [userId, client] of clients.entries()) {
    //         try {
    //           if (client?.started && !client?.paused) {
    //             logger.logInfo(`[WS] Sending daily pause to user ${userId} (daily)`);
    //             await handleMessage({ action: action.WEEK_CLOSE_PAUSE }, clients, userId);
    //             broadcastToSameUser(
    //               connections,
    //               userId,
    //               JSON.stringify({ action: action.WEEK_CLOSE_PAUSE }),
    //             );
    //           }
    //         } catch (err) {
    //           logger.logException(`[WS] Daily pause error for user ${userId}: ${err}`);
    //         }
    //       }
    //     } catch (err) {
    //       logger.logException(`[WS] Daily pause scheduler error: ${err}`);
    //     }
    //   },
    //   { timezone: 'America/Los_Angeles' },
    // );
  };

  scheduleForcedPauses();

  return { path: '/timer-service', handleUpgrade };
};
