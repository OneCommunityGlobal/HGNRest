const _ = require('lodash');

function deepCopyMongooseObjectWithLodash(originalDoc) {
  const plainObject = originalDoc.toObject({ getters: true, virtuals: false });
  const deepCopy = _.cloneDeep(plainObject);
  return deepCopy;
}

function filterFieldsFromObj(obj, keysToFilter) {
  const filteredObj = {};
  console.log('keysToFilter', keysToFilter);
  Object.keys(obj).forEach((key) => {
    if (keysToFilter.includes(key)) {
      filteredObj[key] = obj[key];
    }
  });

  return filteredObj;
}

module.exports = { deepCopyMongooseObjectWithLodash, filterFieldsFromObj };
