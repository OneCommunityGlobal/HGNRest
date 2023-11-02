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

  const bmPostMaterialUpdateRecord = function (req, res) {

    let quantityUsed = +req.body.quantityUsed;
    let quantityWasted = +req.body.quantityWasted;
    let material = req.body.material;
    if(req.body.QtyUsedLogUnit=='percent' && quantityWasted>=0)
    {
      quantityUsed = (+quantityUsed / 100) * material.stockAvailable;
    }
    if(req.body.QtyWastedLogUnit=='percent' && quantityUsed>=0)
    {
      quantityWasted = (+quantityWasted / 100) * material.stockAvailable;
    }

    ItemMaterial.updateOne(
      { _id: req.body.material._id },
      {
        $inc: {
          'stockUsed': quantityUsed,
          'stockWasted': quantityWasted,
          'stockAvailable': -(quantityUsed+quantityWasted)
        }
      }
      )
      .then(results => {res.status(200).send(results)})
      .catch(error => res.status(500).send(error));
  };
  return {
 bmMaterialsList,
    bmPostMaterialUpdateRecord,
};
};

module.exports = bmMaterialsController;
