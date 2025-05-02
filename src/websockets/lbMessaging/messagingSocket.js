const Websockets = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { sendMessageHandler, updateMessageStatusHandler } = require("./lbMessageHandler");
const Message = require('../../models/lbdashboard/message');

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

    const userConnections = new Map();

    const broadcastStatusUpdate = async (messageId, status, userId) => {
        const message = await Message.findByIdAndUpdate(
            messageId,
            { status },
            { new: true }
        );

        if (!message) return;

        const senderSocket = userConnections.get(message.sender)?.socket;
        if (senderSocket && senderSocket.readyState === Websockets.OPEN) {
            senderSocket.send(JSON.stringify({
                action: 'MESSAGE_STATUS_UPDATED',
                payload: { messageId: message._id, status },
            }));
        }

        const receiverSocket = userConnections.get(message.receiver)?.socket;
        if (receiverSocket && receiverSocket.readyState === Websockets.OPEN) {
            receiverSocket.send(JSON.stringify({
                action: 'MESSAGE_STATUS_UPDATED',
                payload: { messageId: message._id, status },
            }));
        }
    };

    wss.on('connection', (ws, req) => {
        const { userId } = req;
        userConnections.set(userId, { socket: ws, isActive: true, inChatWith: null });

        ws.on('message', async (data) => {
            const msg = JSON.parse(data.toString());

            if (msg.action === "SEND_MESSAGE") {
                try {
                    const savedMessage = await sendMessageHandler(msg, userId);

                    const senderState = userConnections.get(userId);
                    if (senderState?.socket?.readyState === Websockets.OPEN) {
                        senderState.socket.send(JSON.stringify({
                            action: 'RECEIVE_MESSAGE',
                            payload: savedMessage,
                        }));
                    }

                    const receiverState = userConnections.get(msg.receiver);
                    if (receiverState) {
                        if (receiverState.inChatWith === userId) {
                            savedMessage.status = "read";
                        } else if (receiverState.isActive) {
                            savedMessage.status = "delivered";
                        } else {
                            savedMessage.status = "sent";
                        }
                        await savedMessage.save();

                        if (receiverState.socket?.readyState === Websockets.OPEN) {
                            if (receiverState.inChatWith === userId) {
                                receiverState.socket.send(JSON.stringify({
                                    action: 'RECEIVE_MESSAGE',
                                    payload: savedMessage,
                                }));
                            }
                        }

                        broadcastStatusUpdate(savedMessage._id, savedMessage.status, userId);
                    }
                } catch (error) {
                    console.error("❌ Error sending message:", error);
                    ws.send(JSON.stringify({
                        action: 'SEND_MESSAGE_FAILED',
                        error: 'Could not send message',
                    }));
                }
            } else if (msg.action === "UPDATE_CHAT_STATE") {
                const userState = userConnections.get(userId);
                if (userState) {
                    userState.isActive = msg.isActive;
                    userState.inChatWith = msg.inChatWith || null;
                }
            }
        });

        ws.on('close', () => {
            userConnections.delete(userId);
        });
    });

    return { path: '/messaging-service', handleUpgrade };
};