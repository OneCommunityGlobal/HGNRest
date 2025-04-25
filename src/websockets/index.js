/* eslint-disable no-restricted-syntax */
/* eslint-disable operator-linebreak */
/* eslint-disable consistent-return */
/* eslint-disable quotes */

/* eslint-disable linebreak-style */
const WebSocket = require('ws');
const {Server} = require('socket.io');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const config = require('../config');
import Message from '../models/lbdashboard/message'


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
  console.log("🔑 Received WebSocket token:", authToken);

  if (!authToken) {
    console.error("❌ WebSocket authentication failed: No token provided");
    res('401 Unauthorized', null);
    return;
  }

  let payload = '';
  try {
    payload = jwt.verify(authToken, config.JWT_SECRET);
    console.log("✅ WebSocket authentication successful:", payload);
    res(null, payload.userid);
  } catch (error) {
    console.error("❌ WebSocket authentication failed:", error.message);
    res('401 Unauthorized', null);
  }
};

/**
 * Here we start the timer service.
 * First we create a map to store the clients and start the Websockets Server.
 * Then we set the upgrade event listener to the Express Server, authenticate the user and
 * if it is valid, we add the user id to the request and handle the upgrade and emit the connection event.
 */
export default async (expServer) => {
  const wss = new WebSocket.Server({
    noServer: true,
    path: '/timer-service',
  });

  expServer.on('upgrade', (request, socket, head) => {
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
  });

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
      if (msg.userId) broadcastToSameUser(connections, msg.userId, resp);

      if (msg.action === "SEND_MESSAGE") {
        const chatMessage = {
          sender: userId, // from JWT
          receiver: msg.receiver,
          content: msg.content,
          status: 'sent',
          isRead: false,
          timestamp: new Date(),
        };
    
        try {
          // 💾 Save message to MongoDB
          const savedMessage = await Message.create(chatMessage);
          // 📤 Send to receiver
            broadcastToSameUser(connections, msg.receiver, JSON.stringify({
              action: 'RECEIVE_MESSAGE',
              // payload: savedMessage,
              payload: {
                ...savedMessage.toObject(),
                status: 'delivered'
              }
            }));
          
          // 🔁 Optional: echo back to sender
          ws.send(JSON.stringify({
            action: 'RECEIVE_MESSAGE',
            payload: savedMessage,
          }));
    
        } catch (err) {
          console.error("❌ Error saving message:", err);
          ws.send(JSON.stringify({
            action: 'SEND_MESSAGE_FAILED',
            error: "Could not send message"
          }));
        }
    
        return;
      }
      if (msg.action === "MESSAGES_READ") {
        try {
          const { messageIds, sender } = msg;
          
          // Update messages in database
          await Message.updateMany(
            { 
              _id: { $in: messageIds },
              sender: sender,
              receiver: userId
            },
            { 
              $set: { 
                isRead: true,
                status: 'read',
                readAt: new Date()
              } 
            }
          );
      
          // Notify sender that messages were read
          broadcastToSameUser(connections, sender, JSON.stringify({
            action: 'MESSAGE_READ',
            messageIds,
            readBy: userId,
            readAt: new Date()
          }));
      
        } catch (err) {
          console.error("❌ Error updating message status:", err);
          ws.send(JSON.stringify({
            action: 'MESSAGE_STATUS_UPDATE_FAILED',
            error: "Could not update message status"
          }));
        }
        return;
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

  return wss;
};

export const setupMessagingWebSocket = (expServer) => {
  const io = new Server(expServer, {
    path: "/lb-messaging",
    cors: {
      origin: "*", // Adjust this to your frontend's origin
      methods: ["GET", "POST"],
    },
  });

  console.log("✅ Messaging Socket.IO server initialized on /lb-messaging");

  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    console.log("Received token:", token);
    if (!token) {
      console.error("❌ Socket.IO authentication failed: No token provided");
      return next(new Error("Authentication error"));
    }

    try {
      const payload = jwt.verify(token, config.JWT_SECRET);
      socket.userId = payload.userid; // Attach userId to the socket
      console.log("✅ Socket.IO authentication successful:", payload);
      next();
    } catch (error) {
      console.error("❌ Socket.IO authentication failed:", error.message);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ New Socket.IO connection established for user: ${socket.userId}`);
  
    socket.on("SEND_MESSAGE", async (data) => {
      const { receiver, content } = data;
      const chatMessage = {
        sender: socket.userId,
        receiver,
        content,
        status: "sent",
        isRead: false,
        timestamp: new Date(),
      };
  
      try {
        const savedMessage = await Message.create(chatMessage);
  
        // Emit the message to the receiver
        io.to(receiver).emit("RECEIVE_MESSAGE", {
          ...savedMessage.toObject(),
          status: "delivered",
        });
  
        // Echo back to the sender
        socket.emit("RECEIVE_MESSAGE", savedMessage);
      } catch (err) {
        console.error("❌ Error saving message:", err);
        socket.emit("SEND_MESSAGE_FAILED", { error: "Could not send message" });
      }
    });
  });

  return io;
};