const mongoose = require('mongoose')

const bmMaterialsController = function (ItemMaterial) {
  const bmMaterialsList = async function _matsList(req, res) {
    try {
      ItemMaterial.find()
      .populate([
        {
          path: 'project',
          select: '_id projectName'
        },
        {
          path: 'inventoryItemType',
          select: '_id name uom totalStock totalAvailable'
        },
        {
          path: 'usageRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName'
          }
        },
        {
          path: 'updateRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName'
          }
        },
        {
          path: 'purchaseRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName'
          }
        }
      ])
      .exec()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(500).send(error))
    } catch (err) {
      res.json(err);
    }
  };

  const bmPostMaterialUpdateRecord = function (req, res) {
    console.log(req.body);
    ItemMaterial.update(
      { "_id": req.body.material._id },
      {
          $push: {
            updateRecord: {
              date : req.body.date,
              createdBy : req.body.requestor.requestorId,
              action : req.body.action,
              cause : req.body.cause,
              quantity : req.body.quantity,
              description : req.body.description
            }
          }
      }
      )
      .then(results => res.status(200).send(results))
      .catch(error => res.status(500).send(error))
  };
  return { bmMaterialsList,
    bmPostMaterialUpdateRecord };
};

module.exports = bmMaterialsController;