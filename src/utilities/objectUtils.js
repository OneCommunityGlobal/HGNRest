const _ = require('lodash');

function deepCopyMongooseObjectWithLodash(originalDoc) {
  const plainObject = originalDoc.toObject({ getters: true, virtuals: false });
  const deepCopy = _.cloneDeep(plainObject);
  return deepCopy;
}



function filterFieldsFromObj(obj, keysToFilter) {
  const filteredObj = {};
  // keys to exclude: sensitive data and verbose data
  const keysToExclude = [
    '_id',
    '__v',
    'password',
    'location',
    'privacySettings',
    'infringements',
    'badgeCollection',
    'copiedAiPrompt',
    'hoursByCategory',
    'savedTangibleHrs',
  ];
  // a list of keys to filter from the object
  Object.keys(obj).forEach((key) => {
    if (keysToExclude.includes(key)) {
      return;
    }
    if (keysToFilter.includes(key)) {
      filteredObj[key] = obj[key];
    }
  });

  return filteredObj;
}

/**
 * Return two objects that have different values for the same key.
 * @param {Object} originalDoc Must be a object
 * @param {Object} updatedDoc
 * @param {Array} keysToFilter
 * @returns
 */
function returnObjectDifference(originalDoc, updatedDoc, keysToFilter) {
  const originalDocFiltered = filterFieldsFromObj(originalDoc, keysToFilter);
  const updatedDocFiltered = filterFieldsFromObj(updatedDoc, keysToFilter);
  // filter out the keys that have the same value in both objects
  const updatedObj = _.omitBy(updatedDocFiltered, (value, key) =>
    _.isEqual(value, originalDocFiltered[key]),
  );
  const originalObj = _.omitBy(originalDocFiltered, (value, key) =>
    _.isEqual(value, updatedDocFiltered[key]),
  );
  // return an object contains the difference between the original and updated document
  return { originalObj, updatedObj };
}

module.exports = { deepCopyMongooseObjectWithLodash, filterFieldsFromObj, returnObjectDifference };
