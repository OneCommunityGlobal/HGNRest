/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Simplified MongoDB connection for CI environments
module.exports.dbConnect = async () => {
  try {
    console.log('=== Starting MongoDB Connection Process ===');

    // Disconnect any existing connections
    if (mongoose.connection.readyState !== 0) {
      console.log('Disconnecting existing MongoDB connection...');
      await mongoose.disconnect();
    }

    // Try to use a real MongoDB connection if available, otherwise use a simple in-memory approach
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test';

    console.log('Using MongoDB URI:', mongoUri);

    // Simple connection options
    const mongooseOpts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 30000, // 30 seconds
      connectTimeoutMS: 30000, // 30 seconds
      maxPoolSize: 1,
      minPoolSize: 0,
    };

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, mongooseOpts);

    console.log('MongoDB connection established successfully');
    console.log('=== MongoDB Connection Process Complete ===');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    console.error('Connection state:', mongoose.connection.readyState);

    // If connection fails, try to create a minimal test environment
    console.log('Attempting to create minimal test environment...');
    await mongoose.disconnect();

    mongoServer = await MongoMemoryServer.create();

    const uri = mongoServer.getUri();

    const mongooseOpts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 30000, // 30 seconds
      connectTimeoutMS: 30000, // 30 seconds
      maxPoolSize: 1,
      minPoolSize: 0,
    };

    await mongoose.connect(uri, mongooseOpts, (err) => {
      if (err) {
        console.error(err);
      }
    });
  }
};

module.exports.dbDisconnect = async () => {
  try {
    console.log('Disconnecting MongoDB...');
    await mongoose.disconnect();
    console.log('MongoDB cleanup completed');
  } catch (error) {
    console.error('Error during MongoDB disconnect:', error);
  }
};

module.exports.dbClearAll = async () => {
  try {
    console.log('Clearing all MongoDB collections...');

    const { collections } = mongoose.connection;
    console.log(`Found ${Object.keys(collections).length} collections to clear`);

    await Promise.all(
      Object.keys(collections).map(async (key) => {
        const collection = collections[key];
        try {
          if (collection && typeof collection.deleteMany === 'function') {
            const result = await collection.deleteMany({});
            console.log(`Cleared collection ${key}: ${result.deletedCount} documents`);
          } else {
            console.log(`Skipping collection ${key} (not a real collection)`);
          }
        } catch (error) {
          console.warn(`Failed to clear collection ${key}:`, error.message);
        }
      }),
    );

    console.log('All collections cleared successfully');
  } catch (error) {
    console.error('Error clearing collections:', error);
  }
};

module.exports.dbClearCollections = async (...collectionNames) => {
  try {
    console.log(`Clearing specific collections: ${collectionNames.join(', ')}`);

    await Promise.all(
      collectionNames.map(async (collectionName) => {
        const collection = mongoose.connection.collections[collectionName];
        if (collection && typeof collection.deleteMany === 'function') {
          try {
            const result = await collection.deleteMany({});
            console.log(`Cleared collection ${collectionName}: ${result.deletedCount} documents`);
          } catch (error) {
            console.warn(`Failed to clear collection ${collectionName}:`, error.message);
          }
        } else {
          console.log(`Collection ${collectionName} not found or not a real collection`);
        }
      }),
    );
  } catch (error) {
    console.error('Error clearing specific collections:', error);
  }
};
