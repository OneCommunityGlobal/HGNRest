/* eslint-disable no-restricted-syntax */
/* eslint-disable operator-linebreak */
/* eslint-disable consistent-return */
/* eslint-disable quotes */
/* eslint-disable linebreak-style */
const WebSocket = require("ws");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { getTimer, handleMessage, action } = require("./TimerService/");

/*
Here we authenticate the user.
We get the token from the headers and try to verify it.
If it fails, we throw an error.
Else we check if the token is valid and if it is, we return the user id.
*/
export const authenticate = (req, res) => {
  const authToken = req.headers?.["sec-websocket-protocol"];
  let payload = "";
  try {
    payload = jwt.verify(authToken, config.JWT_SECRET);
  } catch (error) {
    res("401 Unauthorized", null);
  }

  if (
    !payload ||
    !payload.expiryTimestamp ||
    !payload.userid ||
    !payload.role ||
    moment().isAfter(payload.expiryTimestamp)
  ) {
    res("401 Unauthorized", null);
  }

  res(null, payload.userid);
};

/*
 * Here we insert the new connection to the connections map.
 * If the user is not in the map, we create a new entry with the user id as key and the connection as value.
 * Else we just push the connection to the array of connections.
 */
const insertNewUser = (connections, userId, wsConn) => {
  const userConnetions = connections.get(userId);
  if (!userConnetions) connections.set(userId, [wsConn]);
  else userConnetions.push(wsConn);
};

/*
 *Here we remove the connection from the connections map.
 *If the user is not in the map, we do nothing.
 *Else we remove the connection from the array of connections.
 *If the array is empty, we delete the user from the map.
 */
const removeConnection = (connections, userId, connToRemove) => {
  const userConnetions = connections.get(userId);
  if (!userConnetions) return;

  const newConns = userConnetions.filter((conn) => conn !== connToRemove);
  if (newConns.length === 0) connections.delete(userId);
  else connections.set(userId, newConns);
};

/*
 * Here we broadcast the message to all the connections that are connected to the same user.
 * We check if the connection is open before sending the message.
 */
const broadcastToSameUser = (connections, userId, data) => {
  const userConnetions = connections.get(userId);
  if (!userConnetions) return;
  userConnetions.forEach((conn) => {
    if (conn.readyState === WebSocket.OPEN) conn.send(data);
  });
};

/*
 * Here we check if there is another connection to the same user.
 * If there is, we return true.
 * Else we return false.
 */
const checkOtherConn = (connections, anotherConn, userId) => {
  const userConnetions = connections.get(userId);
  if (!userConnetions) return false;
  for (const con of userConnetions) {
    if (con !== anotherConn && con.readyState === WebSocket.OPEN) return true;
  }
  return false;
};

/*
Here we start the timer service.
First we create a map to store the clients and start the Websockets Server.
Then we set the upgrade event listener to the Express Server, authenticate the user and
if it is valid, we add the user id to the request and handle the upgrade and emit the connection event.
*/
export default async (expServer) => {
  const clients = new Map();
  const connections = new Map();

  const wss = new WebSocket.Server({
    noServer: true,
    path: "/timer-service",
  });

  expServer.on("upgrade", (request, socket, head) => {
    authenticate(request, (err, client) => {
      if (err || !client) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      request.userId = client;
      wss.handleUpgrade(request, socket, head, (websocket) => {
        wss.emit("connection", websocket, request);
      });
    });
  });

  /*
  For each new connection we start a timer of 5min to check if the connection is alive.
  If it is, we then repeat the process. If it is not, we terminate the connection.
  */
  wss.on("connection", async (ws, req) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const { userId } = req;

    insertNewUser(connections, userId, ws);

    /*
     * Here we get the timer from memory or from the database and send it to the client.
     * We don't broadcast it
     */
    await getTimer(clients, userId);
    ws.send(await handleMessage(action.GET_TIMER, clients, userId));

    /*
    Here we handle the messages from the client.
    And we broadcast the response to all the clients that are connected to the same user.
    */
    ws.on("message", async (data) => {
      const resp = await handleMessage(data, clients, userId);
      broadcastToSameUser(connections, userId, resp);
    });

    /*
    Here we handle the close event.
    If there is another connection to the same user, we don't do anything.
    Else he is the last connection and we do a forced pause if need be.
    This may happen if the user closes all the tabs or the browser or he lost connection with
    the service
    We then remove the connection from the connections map.
    */
    ws.on("close", async () => {
      if (!checkOtherConn(connections, ws, userId)) {
        await handleMessage(action.FORCED_PAUSE, clients, userId);
      }
      removeConnection(connections, userId, ws);
    });
  });

  // The function to check if the connection is alive
  const interval = setInterval(async () => {
    wss.clients.forEach(async (ws) => {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 3000000);

  // Here we just clear the interval when the server closes
  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
};
