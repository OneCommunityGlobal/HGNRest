const Websockets = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { sendMessageHandler, updateMessageStatusHandler } = require("./lbMessageHandler");
const Message = require('../../models/lbdashboard/message');

const authenticate = (req, res) => {
    const authToken = req.headers?.['sec-websocket-protocol'];
    console.log(`Auth Token: ${authToken}`);

    if (!authToken) {
        console.log("No token provided");
        res('401 Unauthorized', null);
        return;
    }

    try {
        const payload = jwt.verify(authToken, config.JWT_SECRET);
        console.log("Decoded payload:", payload);
        res(null, payload.userid);
    } catch (error) {
        console.error("Token verification failed:", error);
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
            console.log("WebSocket upgrade successful for messaging service");
            wss.emit('connection', websocket, request);
          });
        });
      };

    const userConnections = new Map(); // { userId: WebSocket }

    wss.on('connection', (ws, req) => {
        const { userId } = req;
        userConnections.set(userId, ws);

        console.log(`📡 User ${userId} connected to messaging service`);

        ws.on('message', async (data) => {
            const msg = JSON.parse(data.toString());

            if (msg.action === "SEND_MESSAGE") {
                const messageDoc = {
                    sender: userId,
                    receiver: msg.receiver,
                    content: msg.content,
                    status: 'sent',
                    isRead: false,
                    timestamp: new Date(),
                };

                try {
                    const savedMessage = await Message.create(messageDoc);

                    const receiverSocket = userConnections.get(msg.receiver);
                    if (receiverSocket && receiverSocket.readyState === Websockets.OPEN) {
                        receiverSocket.send(JSON.stringify({
                            action: 'RECEIVE_MESSAGE',
                            payload: {
                                ...savedMessage.toObject(),
                                status: 'delivered',
                            },
                        }));
                    }

                    ws.send(JSON.stringify({
                        action: 'RECEIVE_MESSAGE',
                        payload: savedMessage,
                    }));
                } catch (error) {
                    console.error("❌ Error saving message:", error);
                    ws.send(JSON.stringify({
                        action: 'SEND_MESSAGE_FAILED',
                        error: 'Could not send message',
                    }));
                }
            }
        });

        ws.on('close', () => {
            userConnections.delete(userId);
            console.log(`📴 User ${userId} disconnected from messaging service`);
        });
    });

    console.log("📡 Messaging WebSocket server started on /messaging-service");

    return { path: '/messaging-service', handleUpgrade };
};