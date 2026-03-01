const Websockets = require('ws');
const logger = require('../../startup/logger');

class ConnectionManager {
  constructor() {
    // Store multiple connections per user: { userId: [{ socket, isActive, inChatWith }] }
    this.userConnections = new Map();
  }

  addUserConnection(userId, ws) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, []);
    }
    this.userConnections.get(userId).push({ socket: ws, isActive: true, inChatWith: null });
  }

  removeUserConnection(userId, ws) {
    const connections = this.userConnections.get(userId);
    if (!connections) return;

    const connectionIndex = connections.findIndex((conn) => conn.socket === ws);
    if (connectionIndex !== -1) {
      connections.splice(connectionIndex, 1);
      if (connections.length === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  getActiveConnections(userId) {
    const connections = this.userConnections.get(userId);
    if (!connections) return [];

    // Filter out closed connections
    const activeConnections = connections.filter(
      (conn) => conn.socket && conn.socket.readyState === Websockets.OPEN,
    );

    // Update the connections array if any were filtered out
    if (activeConnections.length !== connections.length) {
      this.userConnections.set(userId, activeConnections);
      if (activeConnections.length === 0) {
        this.userConnections.delete(userId);
      }
    }

    return activeConnections;
  }

  broadcastToUser(userId, message) {
    const activeConnections = this.getActiveConnections(userId);
    activeConnections.forEach((conn) => {
      try {
        if (conn.socket.readyState === Websockets.OPEN) {
          conn.socket.send(JSON.stringify(message));
        }
      } catch (error) {
        logger.logException(error);
      }
    });
  }
}

module.exports = ConnectionManager;
