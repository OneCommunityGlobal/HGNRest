/* eslint-disable no-restricted-syntax */
/* eslint-disable operator-linebreak */
/* eslint-disable consistent-return */
/* eslint-disable quotes */

/* eslint-disable linebreak-style */
const WebSocket = require('ws');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const config = require('../config');

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
      const resp = await handleMessage(msg, clients, msg.userId ?? userId);
      broadcastToSameUser(connections, userId, resp);
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

  return { path: '/timer-service', handleUpgrade };
};
