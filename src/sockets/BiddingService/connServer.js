const mongoose = require('mongoose');

module.exports = function (server) {
  console.log('socketIO inside');
  const socketIO = require('socket.io');
  const Bids = require('../../models/lbdashboard/bids');
  const Users = require('../../models/lbdashboard/users');

  const io = socketIO(server, {
    cors: { origin: '*' },
    methods: ['GET', 'POST'], // allow all origins for now (adjust for production)
  });
  // console.log(io);
  io.engine.on('connection_error', (err) => {
    console.log('io.engine error');
    console.log(err.req); // the request object
    console.log(err.code); // the error code, for example 1
    console.log(err.message); // the error message, for example "Session ID unknown"
    console.log(err.context); // some additional error context
  });

  // Simple token validation function
  function isValid(token) {
    // Replace with real validation, e.g. JWT verification
    return token === 'secret123';
  }
  io.use((socket, next) => {
    console.log('before token');
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (isValid(token)) {
      next();
    } else {
      next(new Error('invalid'));
    }
  });

  io.emit('hi', 'everyone');

  io.on('connection', (socket) => {
    //  console.log('🔌 A user connected:', socket.id);

    socket.on('new-bid', async ({ listId, amount, bidder }) => {
      const listingId = mongoose.Types.ObjectId('67dc4d543f1a8ec3a678fd70');
      console.log(`itemId is ${listingId}`);
      console.log(`amount is ${amount}`);
      console.log(`user is ${socket.handshake.auth.email}`);

      try {
        const user = await Users.findOne({
          email: socket.handshake.auth.email,
        });
        const userId = user?._id;
        console.log(userId);

        console.log({
          listingId, // mongoose.Types.ObjectId(listingId),
          userId,
        });
        const matchBid = await Bids.findOne({
          listingId, // mongoose.Types.ObjectId(listingId),
          userId,
        });
        console.log(matchBid);
        console.log(matchBid.id);
        console.log(mongoose.Types.Decimal128.fromString(amount.toString()));
        await Bids.updateOne(
          { listingId, userId },
          {
            $push: {
              biddingHistory: {
                bidPrice: mongoose.Types.Decimal128.fromString(amount.toString()),
                createdDatetime: new Date(),
              },
            },
          },
        );
      } catch (error) {
        console.log(error);
      }
      console.log('Bid Received');
      // Notify all connected clients
      io.emit('bid-updated', `current bid price is ${amount}`);

      socket.broadcast.emit('bid-updated', `current bid price is ${amount}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
    });
  });
};
