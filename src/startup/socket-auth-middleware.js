module.exports = function (socket, next) {
  const { token } = socket.handshake.auth;
  console.log(' Token received:');

  if (token === 'secret123') {
    next();
  } else {
    next(new Error('Unauthorized'));
  }
};
