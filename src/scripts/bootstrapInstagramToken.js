// scripts/seedInstagramToken.js
require('dotenv').config();
const mongoose = require('mongoose');
const MetaToken = require('../models/metaToken');

async function seed() {
  const appName = process.env.appName || 'HGNRest';
  const uri = `mongodb+srv://${encodeURIComponent(process.env.user)}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${appName}`;

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // 👇 paste your token and how many seconds until it expires
  const accessToken =
    'EAAO2rE1UeQ8BSSFMkAW9aZA8ZCXjPZCMx1cFo1VbAcNsdCTRL1aafgdCdzIyIBplyjSkhZBJEbEWf5RKQpxL0rCCfKdIRImMj35GdGidW1xLm6alWWGSDvwInBaN69fO7eC28J1ZCZBJ1jUPQ9wH0jcJZAfRAESbRsHsMP9E8wHzjBui2kBxoQgxINXjoDmGLHU';
  const expiresInSeconds = 5184000; // 60 days, adjust if you know the real value; use 3600 for a short-lived token

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await MetaToken.findOneAndUpdate(
    { platform: 'instagram' },
    { accessToken, expiresAt, lastRefreshedAt: new Date() },
    { upsert: true },
  );

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
