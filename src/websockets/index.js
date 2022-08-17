/* eslint-disable consistent-return */
/* eslint-disable no-var */
/* eslint-disable quotes */
/* eslint-disable linebreak-style */
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const exitHook = require('async-exit-hook');
const setupTimerService = require("./TimerService/index").default;
const {
  redisClients,
  authenticate,
  listener,
  handleMessage,
  TIMER_UPDATES_CHANNEL,
  updateClientsList,
  getUserConnectionKey,
  handleClose,
} = require("./api");
const logger = require('../startup/logger');

export default async (expressServer) => {
  var timerService = await setupTimerService();
  var clients = {};

  await Promise.all([
    redisClients.publisher.connect(),
    redisClients.subscriber.connect(),
    redisClients.main.connect(),
  ]);

  const websocketServer = new WebSocket.Server({
    noServer: true,
    path: "/timer-service",
    clientTracking: true,
  });

  expressServer.on("upgrade", (request, socket, head) => {
    authenticate(request, (err, client) => {
      if (err || !client) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      request.userId = client;
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request);
      });
    });
  });


  await redisClients.subscriber.subscribe(TIMER_UPDATES_CHANNEL, message => listener(message, { clients }));

  redisClients.main.on("error", err => logger.logException(err));


  const cleanupRedis = async (callback) => {
    const cleanupArray = Object.keys(clients).map(userIdProperty => new Promise(async (resolve, reject) => {
      try {
          const userConnections = await redisClients.main.get(getUserConnectionKey(userIdProperty));

          const currentUserConnections = +userConnections - clients[userIdProperty].length;
          await redisClients.main.set(getUserConnectionKey(userIdProperty), currentUserConnections);

        if (currentUserConnections === 0) {
            await timerService.pauseTimerByUserId(userIdProperty, {
              saveDataToDatabase: true,
              isUserPaused: true,
              isApplicationPaused: false,
              redisClients,
            });

            redisClients.main.del(getUserConnectionKey(userIdProperty));
          }

        resolve("Done!");
      } catch (e) {
        reject(e);
     }
   }), []);
    await Promise.all(cleanupArray);
    callback();
  };

    exitHook((callback) => {
        cleanupRedis(callback);
    });

  websocketServer.on(
    "connection",
    async (websocketConnection, connectionRequest) => {
      let interval;
       // Grab userId from connection
      const userId = `${connectionRequest.userId}`;

      websocketConnection.on("message", message => handleMessage(message, { timerService, userId, websocketConnection }));
      websocketConnection.on("close", () => handleClose({
        timerService,
        userId,
        websocketConnection,
        interval,
        clients,
      }));
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


      // Generate UUID to map between client / server
      const connectionKey = uuidv4();

      // Assign each connection the UUID
      websocketConnection.id = connectionKey;

      // Get current active connection from redis database
      const currentConnections = (await redisClients.main.get(getUserConnectionKey(userId))) ?? 0;

      // Set in redis database number of users connected
      await redisClients.main.set(getUserConnectionKey(userId), `${+currentConnections + 1}`);

      // Add to websocket and update in-memory client mapping
      clients = updateClientsList({
        clients,
        userId,
        connectionKey,
        websocketConnection,
      });


      // keep connection alive between client / server
      keepConnectionAlive();
    },
  );

  return websocketServer;
};
