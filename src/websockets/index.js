/* eslint-disable consistent-return */
/* eslint-disable no-var */
/* eslint-disable quotes */
/* eslint-disable linebreak-style */
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');
const setupTimerService = require("./timerService").default;

export const log = ({ message, type } = {}) => {
  if (type === "INFO") {
    // eslint-disable-next-line no-console
    console.log("----------------------------------\n");
    console.log(message, "\n");
    console.log("\n");
  } else {
    // eslint-disable-next-line no-console
    console.error(message);
  }
};

const updateClientsList = ({
  clients, userId, connectionKey, websocketConnection,
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

const sendMessage = ({ messageToSend, websocketConnection } = {}) => {
  log({
    message: `Single message being sent to Client (${JSON.stringify({ userId: websocketConnection?.userId })})\n = ${JSON.stringify({
      timeObject: messageToSend,
    })}`,
    type: "INFO",
  });
  websocketConnection.send(JSON.stringify(messageToSend));
};

const distrubuteMessage = ({ userId, clients, timeObject }) => {
  log({
    message: `Message Being Distrubuted to Client (${JSON.stringify({ userId, amountOfUsersWatchingThisTimer: clients?.[userId]?.length })})\n = ${JSON.stringify({
      timeObject,
    })}`,
    type: "INFO",
  });
  clients[userId].map(({ websocketConnection }) => websocketConnection.send(JSON.stringify(timeObject)));
};

const authenticate = (request, returnToRequestFlow) => {
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

export default async (expressServer) => {
  var timerService = await setupTimerService();
  var clients = {};


  const websocketServer = new WebSocket.Server({
    noServer: true,
    path: "/websockets",
    clientTracking: true,
  });

  expressServer.on("upgrade", (request, socket, head) => {
    authenticate(request, (err, client) => {
      if (err || !client) {
        log({ message: "Client rejected", type: "INFO" });
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      log({ message: `Client (${JSON.stringify(client)}) connecting to websocket`, type: "INFO" });
      request.userId = client;
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request);
      });
    });
  });

  websocketServer.on(
    "connection",
    async (websocketConnection, connectionRequest) => {
      let interval;
      // Ping and ping method to keep websocket / client persistent
      function keepConnectionAlive() {
        function heartbeat() {
          this.isAlive = true;
        }

        // Set websocket connection to isAlive true
        websocketConnection.isAlive = true;

        // set handler
        websocketConnection.on("pong", heartbeat);

        interval = setInterval(() => {
          websocketServer.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
          });
        }, 30000);
      }

      // Grab userId from connection
      const userId = `${connectionRequest.userId}`;

      // Generate UUID to map between client / server
      const connectionKey = uuidv4();

      // Assign each connection the UUID
      websocketConnection.id = connectionKey;

      // Add to websocket and update in-memory client mapping
      clients = updateClientsList({
        clients, userId, connectionKey, websocketConnection,
      });

      // keep connection alive between client / server
      keepConnectionAlive();

      // Handle Message Callback
      async function handleMessage(data) {
        const intentData = JSON.parse(data?.toString()) ?? {};
        const {
          intent, isUserPaused, restartTimerWithSync, saveTimerData, isApplicationPaused,
        } = intentData;

        log({
          message: `Client (${JSON.stringify({ userId, amountOfUsersWatchingThisTimer: clients?.[userId]?.length })})\n is sending a message ${JSON.stringify({
            intent, isUserPaused, restartTimerWithSync, saveTimerData,
          })}`,
          type: "INFO",
        });
        switch (intent) {
          case "START_TIMER":
            distrubuteMessage({
              userId,
              clients,
              timeObject: await timerService.startTimerByUserId(userId, { restartTimerWithSync }),
            });
            break;
          case "GET_TIMER":
            sendMessage({ websocketConnection, messageToSend: await timerService.getTimerByUserId(userId) });
            break;
          case "PAUSE_TIMER":
            distrubuteMessage({
              userId,
              clients,
              timeObject: await timerService.pauseTimerByUserId(userId, { isUserPaused, saveTimerData, isApplicationPaused }),
            });
            break;
          case "STOP_TIMER":
            distrubuteMessage({
              userId,
              clients,
              timeObject: await timerService.removeTimerByUserId(userId),
            });
            break;
          default:
            sendMessage({ websocketConnection, messageToSend: ("Please enter a valid intent") });
        }
      }

      async function handleClose() {
        const listners = clients[userId];
        clearInterval(interval);
        const userConnections = clients?.[userId]?.length;

        clients[userId] = listners.filter(
          ({ connectionKey: activeConnectionKey }) => activeConnectionKey === websocketConnection.id,
        );

        if (userConnections < 1) {
          await timerService.pauseTimerByUserId(userId, { saveDataToDatabase: true, isUserPaused: false, isApplicationPaused: false });
        }
      }

      websocketConnection.on("message", handleMessage);
      websocketConnection.on("close", handleClose);
    },
  );

  return websocketServer;
};
