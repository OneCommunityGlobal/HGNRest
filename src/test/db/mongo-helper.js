const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const waitForConnection = async (maxAttempts = 10) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (mongoose.connection.readyState === 1) {
      console.log(`MongoDB connection ready on attempt ${attempt}`);
      return;
    }
    console.log(`Waiting for MongoDB connection... (attempt ${attempt}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
  }
  throw new Error('MongoDB connection failed to establish after multiple attempts');
};

module.exports.dbConnect = async () => {
  try {
    console.log('Starting MongoDB connection...');
    await mongoose.disconnect();

    console.log('Creating MongoDB Memory Server...');
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test',
      },
      binary: {
        version: '4.0.27',
      },
    });

    const uri = mongoServer.getUri();
    console.log('MongoDB URI obtained:', uri.substring(0, 50) + '...');

    const mongooseOpts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 60000, // 60 seconds
      socketTimeoutMS: 60000, // 60 seconds
      connectTimeoutMS: 60000, // 60 seconds
      maxPoolSize: 10,
      retryWrites: true,
    };

    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, mongooseOpts);

    console.log('Waiting for connection to be ready...');
    await waitForConnection();

    console.log('MongoDB connection established successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
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
