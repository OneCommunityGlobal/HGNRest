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

    if(quantityUsed>material.stockAvailable || quantityWasted>material.stockAvailable || (quantityUsed+quantityWasted)>material.stockAvailable)
    {
      res.status(500).send('Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available.')
    }
    else
   {
      quantityUsed = Number.parseFloat(quantityUsed.toFixed(2));
      quantityWasted = Number.parseFloat(quantityWasted.toFixed(2));
      let newAvailable = Number.parseFloat(quantityUsed+quantityWasted);

      ItemMaterial.updateOne(
        { _id: req.body.material._id },
        {
          $inc: {
            'stockUsed': quantityUsed,
            'stockWasted': quantityWasted,
            'stockAvailable': -(newAvailable)
          },
          $push: {
            updateRecord: {
              date: req.body.date,
              createdBy: req.body.requestor.requestorId,
              quantity: -(quantityUsed+quantityWasted),
            },
          }
        }
        )
        .then(results => {res.status(200).send(results)})
        .catch(error => res.status(500).send({'message':error}));
   }
  };

  const bmPostMaterialUpdateBulk = function (req, res) {
    const materialUpdates= req.body;
    const updateRecordsToBeAdded = materialUpdates.map(payload => {
      let quantityUsed = +payload.quantityUsed;
      let quantityWasted = +payload.quantityWasted;
      let material = payload.material;
      if(payload.QtyUsedLogUnit=='percent' && quantityWasted>=0)
      {
        quantityUsed = (+quantityUsed / 100) * material.stockAvailable;
      }
      if(payload.QtyWastedLogUnit=='percent' && quantityUsed>=0)
      {
        quantityWasted = (+quantityWasted / 100) * material.stockAvailable;
      }

      quantityUsed = Number.parseFloat(quantityUsed.toFixed(2));
      quantityWasted = Number.parseFloat(quantityWasted.toFixed(2));
      let newAvailable = Number.parseFloat(quantityUsed+quantityWasted);

      return ({
        updateId: material._id,
        increment: {
          'stockUsed': quantityUsed,
          'stockWasted': quantityWasted,
          'stockAvailable': -(newAvailable)
        },
        updateValue: {
          createdBy: req.body.requestor.requestorId,
          quantity: -(quantityUsed+quantityWasted),
          date: payload.date,
        }});
      
      });
    console.log(updateRecordsToBeAdded);

    try {
    const updatePromises = updateRecordsToBeAdded.map(updateItem => ItemMaterial.updateOne(
        { _id: updateItem.updateId },
        { 
          $inc: updateItem.increment ,
          $push: { usageRecord: updateItem.updateValue } },
      ).exec());
    Promise.all(updatePromises)
    .then((results) => {
      res.status(200).send({ result: `Successfully posted log for ${results.length} Material records.` });
    })
    .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  return {
 bmMaterialsList,
    bmPostMaterialUpdateRecord,
    bmPostMaterialUpdateBulk
};
};

module.exports = bmMaterialsController;
