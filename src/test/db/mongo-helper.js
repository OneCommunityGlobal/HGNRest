const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// More robust MongoDB connection for CI environments
module.exports.dbConnect = async () => {
  try {
    console.log('=== Starting MongoDB Connection Process ===');

    // Disconnect any existing connections
    if (mongoose.connection.readyState !== 0) {
      console.log('Disconnecting existing MongoDB connection...');
      await mongoose.disconnect();
    }

    // Create MongoDB Memory Server with more robust configuration
    console.log('Creating MongoDB Memory Server...');
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test',
        port: undefined, // Let it choose a random port
        ip: '127.0.0.1',
      },
      binary: {
        version: '4.0.27',
        downloadDir: '/tmp/mongodb-binaries', // Use temp directory
      },
      autoStart: true,
      debug: false,
    });

    const uri = mongoServer.getUri();
    console.log('MongoDB URI obtained:', uri.substring(0, 50) + '...');

    // More robust connection options
    const mongooseOpts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 120000, // 2 minutes
      socketTimeoutMS: 120000, // 2 minutes
      connectTimeoutMS: 120000, // 2 minutes
      maxPoolSize: 1, // Reduce pool size for CI
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      wtimeout: 10000,
    };

    console.log('Connecting to MongoDB with options:', JSON.stringify(mongooseOpts, null, 2));

    // Connect with explicit error handling
    await mongoose.connect(uri, mongooseOpts);

    console.log('MongoDB connection initiated, waiting for ready state...');

    // Wait for connection to be fully ready
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max

    while (mongoose.connection.readyState !== 1 && attempts < maxAttempts) {
      attempts++;
      console.log(`Waiting for MongoDB connection... (attempt ${attempts}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (mongoose.connection.readyState !== 1) {
      throw new Error(
        `MongoDB connection failed after ${maxAttempts} attempts. ReadyState: ${mongoose.connection.readyState}`,
      );
    }

    console.log(`MongoDB connection established successfully on attempt ${attempts}`);
    console.log('=== MongoDB Connection Process Complete ===');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    console.error('Connection state:', mongoose.connection.readyState);
    throw error;
  }
};

module.exports.dbDisconnect = async () => {
  try {
    console.log('Disconnecting MongoDB...');
    await mongoose.disconnect();

    if (mongoServer) {
      console.log('Stopping MongoDB Memory Server...');
      await mongoServer.stop();
    }

    console.log('MongoDB cleanup completed');
  } catch (error) {
    console.error('Error during MongoDB disconnect:', error);
  }
};

module.exports.dbClearAll = async () => {
  try {
    console.log('Clearing all MongoDB collections...');

    // Wait for connection to be ready
    if (mongoose.connection.readyState !== 1) {
      console.log('Waiting for MongoDB connection before clearing...');
      let attempts = 0;
      while (mongoose.connection.readyState !== 1 && attempts < 10) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const collections = mongoose.connection.collections;
    console.log(`Found ${Object.keys(collections).length} collections to clear`);

    for (const key in collections) {
      const collection = collections[key];
      try {
        const result = await collection.deleteMany({});
        console.log(`Cleared collection ${key}: ${result.deletedCount} documents`);
      } catch (error) {
        console.warn(`Failed to clear collection ${key}:`, error.message);
      }
    }

    console.log('All collections cleared successfully');
  } catch (error) {
    console.error('Error clearing collections:', error);
  }
};

module.exports.dbClearCollections = async (...collectionNames) => {
  try {
    console.log(`Clearing specific collections: ${collectionNames.join(', ')}`);

    for (const collectionName of collectionNames) {
      const collection = mongoose.connection.collections[collectionName];
      if (collection) {
        try {
          const result = await collection.deleteMany({});
          console.log(`Cleared collection ${collectionName}: ${result.deletedCount} documents`);
        } catch (error) {
          console.warn(`Failed to clear collection ${collectionName}:`, error.message);
        }
      } else {
        console.log(`Collection ${collectionName} not found`);
      }
    }
  } catch (error) {
    console.error('Error clearing specific collections:', error);
  }
};
