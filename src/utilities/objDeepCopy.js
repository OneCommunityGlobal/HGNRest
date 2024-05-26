const _ = require('lodash');

async function deepCopyMongooseObjectWithLodash(originalDoc) {
  const plainObject = originalDoc.toObject({ getters: true, virtuals: false });
  const deepCopy = _.cloneDeep(plainObject);
  return deepCopy;
}

module.exports = { deepCopyMongooseObjectWithLodash };
