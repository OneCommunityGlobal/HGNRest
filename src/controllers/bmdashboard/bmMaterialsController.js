const mongoose = require('mongoose');

const bmMaterialsController = function (ItemMaterial) {
  const bmMaterialsList = async function _matsList(req, res) {
    try {
      ItemMaterial.find()
      .populate([
        {
          path: 'project',
          select: '_id projectName',
        },
        {
          path: 'inventoryItemType',
          select: '_id name uom totalStock totalAvailable',
        },
        {
          path: 'usageRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName',
          },
        },
        {
          path: 'updateRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName',
          },
        },
        {
          path: 'purchaseRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName',
          },
        },
      ])
      .exec()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  return { bmMaterialsList };
};

module.exports = bmMaterialsController;
