const WebSocket = require('ws');

/**
 * Here we insert the new connection to the connections map.
 * If the user is not in the map, we create a new entry with the user id as key and the connection as value.
 * Else we just push the connection to the array of connections.
 */
export function insertNewUser(connections, userId, wsConn) {
  const userConnetions = connections.get(userId);
  if (!userConnetions) connections.set(userId, [wsConn]);
  else userConnetions.push(wsConn);
}

/**
 *Here we remove the connection from the connections map.
 *If the user is not in the map, we do nothing.
 *Else we remove the connection from the array of connections.
 *If the array is empty, we delete the user from the map.
 */
export function removeConnection(connections, userId, connToRemove) {
  const userConnetions = connections.get(userId);
  if (!userConnetions) return;

  const newConns = userConnetions.filter(conn => conn !== connToRemove);
  if (newConns.length === 0) connections.delete(userId);
  else connections.set(userId, newConns);
}

/**
 * Here we broadcast the message to all the connections that are connected to the same user.
 * We check if the connection is open before sending the message.
 */
export function broadcastToSameUser(connections, userId, data) {
  const userConnetions = connections.get(userId);
  if (!userConnetions) return;
  userConnetions.forEach((conn) => {
    if (conn.readyState === WebSocket.OPEN) conn.send(data);
  });
}

/**
 * Here we check if there is another connection to the same user.
 * If there is, we return true.
 * Else we return false.
 */
export function hasOtherConn(connections, userId, anotherConn) {
  if (!connections.has(userId)) return false;
  const userConnections = connections.get(userId);
  return userConnections.some(con => con !== anotherConn && con.readyState === WebSocket.OPEN);
}
