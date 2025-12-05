const mongoose = require('mongoose');
(async () => {
  const uri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;
  console.log('URI:', uri.replace(/\/\/.*@/, '//<hidden>@'));
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(':white_tick: Connected to MongoDB successfully');
  } catch (err) {
    console.error(':x: Failed to connect');
    console.error('Name:', err.name);
    console.error('Message:', err.message);
    console.dir(err.reason, { depth: 6 });
  } finally {
    process.exit(0);
  }
})();