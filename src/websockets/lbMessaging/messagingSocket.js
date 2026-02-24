/* eslint-disable no-console */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-unused-vars */
const Websockets = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const ConnectionManager = require('./ConnectionManager');
const { handleSocketMessage } = require('./socketEvents');

const authenticate = (req, res) => {
  const authToken = req.headers?.['sec-websocket-protocol'];

  if (!authToken) {
    res('401 Unauthorized', null);
    return;
  }

  try {
    const payload = jwt.verify(authToken, config.JWT_SECRET);
    res(null, payload.userid);
  } catch (error) {
    res('401 Unauthorized', null);
  }
};

export default () => {
  const wss = new Websockets.Server({
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

  // Store multiple connections per user: { userId: [{ socket, isActive, inChatWith }] }
  const connectionManager = new ConnectionManager();

  wss.on('connection', (ws, req) => {
    const { userId } = req;
    connectionManager.addUserConnection(userId, ws);

    ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      await handleSocketMessage(msg, userId, ws, connectionManager);
    });

    ws.on('close', () => {
      connectionManager.removeUserConnection(userId, ws);
    });
  });

  return { path: '/messaging-service', handleUpgrade };
};
