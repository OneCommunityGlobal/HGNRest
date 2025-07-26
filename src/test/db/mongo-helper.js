const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

module.exports.dbConnect = async () => {
  await mongoose.disconnect();

  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'test',
    },
    binary: {
      version: '4.0.27',
    },
  });

  const uri = mongoServer.getUri();

  const mongooseOpts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 30000, // 30 seconds
    connectTimeoutMS: 30000, // 30 seconds
    maxPoolSize: 10,
    retryWrites: true,
  };

  await mongoose.connect(uri, mongooseOpts, (err) => {
    if (err) {
      console.error('MongoDB connection error:', err);
    }
  });

  // Wait for connection to be fully established
  if (mongoose.connection.readyState !== 1) {
    console.log('Waiting for MongoDB connection to be fully established...');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MongoDB connection timeout'));
      }, 30000);

      mongoose.connection.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
};

module.exports.dbDisconnect = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

module.exports.dbClearAll = async () => {
  // Wait for connection to be ready
  if (mongoose.connection.readyState !== 1) {
    console.log('Waiting for MongoDB connection to be ready...');
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
      setTimeout(resolve, 5000); // 5 second timeout
    });
  }

  // eslint-disable-next-line prefer-destructuring
  const collections = mongoose.connection.collections;

  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const key in collections) {
    const collection = collections[key];
    try {
      await collection.deleteMany({});
    } catch (error) {
      console.warn(`Failed to clear collection ${key}:`, error.message);
    }
  }
};

module.exports.dbClearCollections = async (...collectionNames) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const collectionName of collectionNames) {
    const collection = mongoose.connection.collections[collectionName];
    if (collection) {
      await collection.deleteMany({});
    }
  }
};
