const bmConsumableController = function (BuildingConsumable) {
  const fetchBMConsumables = async (req, res) => {
    try {
      BuildingConsumable
        .find()
        .populate([
          {
            path: 'project',
            select: '_id name',
          },
          {
            path: 'itemType',
            select: '_id name unit',
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
              path: 'requestedBy',
              select: '_id firstName lastName',
            },
          },
        ])
        .exec()
        .then((result) => {
          res.status(200).send(result);
        })
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };


  const bmPostConsumableUpdateRecord = function (req, res) {
    const {
     quantityUsed, quantityWasted, QtyUsedLogUnit, QtyWastedLogUnit, stockAvailable, consumable,
    } = req.body;

    let unitsUsed = quantityUsed;
    let unitsWasted = quantityWasted;

    if (quantityUsed >= 0 && QtyUsedLogUnit === 'percent') {
      unitsUsed = (stockAvailable / 100) * quantityUsed;
    }
    if (quantityWasted >= 0 && QtyWastedLogUnit === 'percent') {
      unitsWasted = (stockAvailable / 100) * quantityWasted;
    }
    if (unitsUsed > stockAvailable || unitsWasted > stockAvailable || (unitsUsed + unitsWasted) > stockAvailable) {
      res.status(500).send({message: 'Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available.'});
    } else if (unitsUsed < 0 || unitsWasted < 0){
      res.status(500).send({message: 'Please check the used and wasted stock values. Negative numbers are invalid.'});
    }
    
    else {
      const newStockUsed = parseFloat((consumable.stockUsed + unitsUsed).toFixed(4));
      const newStockWasted = parseFloat((consumable.stockWasted + unitsWasted).toFixed(4));
      const newAvailable = parseFloat((stockAvailable - (unitsUsed + unitsWasted)).toFixed(4));

      BuildingConsumable.updateOne(
        { _id: consumable._id },
        {
          $set: {
            stockUsed: newStockUsed,
            stockWasted: newStockWasted,
            stockAvailable: newAvailable,
          },
          $push: {
            updateRecord: {
              date: req.body.date,
              createdBy: req.body.requestor.requestorId,
              quantityUsed: unitsUsed,
              quantityWasted: unitsWasted,
            },
          },

        },
      )
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => {
        console.log('error: ', error);
        res.status(500).send({ message: error });
      });
  }
};

  return {
      fetchBMConsumables,
      bmPostConsumableUpdateRecord,
  };
};

module.exports = bmConsumableController;
