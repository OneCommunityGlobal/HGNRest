const mongoose = require('mongoose');
const { Collection } = require('mongodb');

mongoose.connect = async () => {
  if (mongoose.connection && typeof mongoose.connection.emit === 'function') {
    mongoose.connection.readyState = 1;
    mongoose.connection.emit('connected');
  }
  return mongoose;
};

const okUpdate = { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
const okDelete = { acknowledged: true, deletedCount: 0 };

const modelStub = {
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
Object.assign(mongoose.Model, modelStub);

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

function cursor() { return { toArray: async () => [], hasNext: async () => false, next: async () => null }; }
function patchCollectionProto(proto) {
  if (!proto) return;
  proto.insertOne = async () => ({ acknowledged: true, insertedId: null });
  proto.insertMany = async () => ({ acknowledged: true, insertedCount: 0, insertedIds: [] });
  proto.updateOne = async () => okUpdate;
  proto.updateMany = async () => okUpdate;
  proto.deleteOne = async () => okDelete;
  proto.deleteMany = async () => okDelete;
  proto.bulkWrite = async () => ({ acknowledged: true, insertedCount: 0, matchedCount: 0, modifiedCount: 0, deletedCount: 0, upsertedCount: 0, upsertedIds: {} });
  proto.findOne = async () => null;
  proto.find = function () { return cursor(); };
  proto.aggregate = function () { return { toArray: async () => [] }; };
  proto.countDocuments = async () => 0;
  proto.estimatedDocumentCount = async () => 0;
  proto.distinct = async () => [];
}
patchCollectionProto(Collection && Collection.prototype);
patchCollectionProto(mongoose.Collection && mongoose.Collection.prototype);

console.log('DB STUB: active');
