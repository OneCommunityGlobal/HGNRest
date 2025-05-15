const mongoose = require('mongoose');

mongoose.connect = async () => {
  console.log('DB STUB: Skipping real Mongo connection');
  if (mongoose.connection && typeof mongoose.connection.emit === 'function') {
    mongoose.connection.readyState = 1;
    mongoose.connection.emit('connected');
  }
  return mongoose;
};

const okUpdate = { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
const okDelete = { acknowledged: true, deletedCount: 0 };

const stub = {
  find: async () => [],
  findOne: async () => null,
  findById: async () => null,
  create: async (...docs) => (docs.length === 1 ? docs[0] : docs),
  insertMany: async () => [],
  updateOne: async () => okUpdate,
  updateMany: async () => okUpdate,
  findOneAndUpdate: async (_f, doc) => (doc ?? null),
  findOneAndDelete: async () => null,
  deleteOne: async () => okDelete,
  deleteMany: async () => okDelete,
  count: async () => 0,
  countDocuments: async () => 0,
  aggregate: async () => [],
  distinct: async () => [],
  estimatedDocumentCount: async () => 0,
};

Object.assign(mongoose.Model, stub);

const Query = mongoose.Query && mongoose.Query.prototype;
if (Query && !Query.__dbStubbed) {
  const origExec = Query.exec;
  Query.exec = function () {
    const op = this.op;
    switch (op) {
      case 'find': return Promise.resolve([]);
      case 'findOne':
      case 'findById': return Promise.resolve(null);
      case 'updateOne':
      case 'updateMany':
      case 'findOneAndUpdate': return Promise.resolve(okUpdate);
      case 'deleteOne':
      case 'deleteMany':
      case 'findOneAndDelete': return Promise.resolve(okDelete);
      case 'count':
      case 'countDocuments':
      case 'estimatedDocumentCount': return Promise.resolve(0);
      case 'aggregate': return Promise.resolve([]);
      default: return origExec.apply(this, arguments);
    }
  };
  Query.__dbStubbed = true;
}

console.log('DB STUB: Mongoose model methods stubbed for local review');
