const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

module.exports.dbConnect = async () => {
  await mongoose.disconnect();

  mongoServer = await MongoMemoryServer.create();

  const uri = mongoServer.getUri();

  const mongooseOpts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  await mongoose.connect(uri, mongooseOpts, (err) => {
    if (err) {
      console.error(err);
    }
  });
};

module.exports.dbDisconnect = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

module.exports.dbClearAll = async () => {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};

module.exports.dbClearCollections = async (...collectionNames) => {
  for (const collectionName of collectionNames) {
    const collection = mongoose.connection.collections[collectionName];
    if (collection) {
      await collection.deleteMany({});
    }
  }
};
