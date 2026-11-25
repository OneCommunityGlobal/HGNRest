// v1.0.0
/* eslint-disable no-console */
// The legacy Mongo driver can include credentials in URI deprecation warnings.
process.noDeprecation = true;
require('dotenv').config();
const mongoose = require('mongoose');
const { seedProjectRisk } = require('../utilities/projectRiskSeeder');

async function run() {
  const { user, password, cluster, dbName, NODE_ENV: environment } = process.env;
  const confirmedDatabase = process.argv[process.argv.indexOf('--confirm-database') + 1];
  if (
    !dbName ||
    confirmedDatabase !== dbName ||
    environment === 'production' ||
    /prod/i.test(dbName)
  ) {
    throw new Error(
      'Use a development database and pass --confirm-database with its exact configured dbName.',
    );
  }
  if (!user || !password || !cluster) throw new Error('Missing database configuration');
  const uri = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority`;
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log(await seedProjectRisk());
}

run()
  .catch(() => {
    console.error(
      'Risk demo seeding failed. Check the development database configuration and confirmation argument.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
