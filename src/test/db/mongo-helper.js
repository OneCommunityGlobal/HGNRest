/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
const { MongoMemoryServer } = require('mongodb-memory-server');

// Simplified MongoDB connection for CI environments
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
  // eslint-disable-next-line prefer-destructuring
  // const collections = mongoose.connection.collections;

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
