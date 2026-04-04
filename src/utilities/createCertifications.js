require('dotenv').config();
const mongoose = require('mongoose');

const certification = require('../models/certification');
const educatorCertification = require('../models/educatorCertification');

async function connect() {
  const uri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

async function createCollections() {
  try {
    await connect();
    await certification.createCollection();
    await educatorCertification.createCollection();
    console.log('✅ Collections created or already exist');
  } catch (err) {
    console.error('❌ Error creating collections:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 MongoDB connection closed');
  }
}

if (require.main === module) {
  createCollections();
}

module.exports = { connect, createCollections };
