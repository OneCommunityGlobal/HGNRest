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

    // Change material to consumable
    const updateBMConsumableBulk = function (req, res) {
      const consumableUpdates = req.body.updateConsumables;
      let errorFlag = false;
      const updateRecordsToBeAdded = [];
      for (let i = 0; i < consumableUpdates.length; i++) {
        const payload = consumableUpdates[i];
        let quantityUsed = +payload.quantityUsed;
        let quantityWasted = +payload.quantityWasted;
        const { consumable } = payload;
        if (payload.QtyUsedLogUnit == 'percent' && quantityWasted >= 0) {
          quantityUsed = +((+quantityUsed / 100) * consumable.stockAvailable).toFixed(4);
        }
        if (payload.QtyWastedLogUnit == 'percent' && quantityUsed >= 0) {
          quantityWasted = +((+quantityWasted / 100) * consumable.stockAvailable).toFixed(4);
        }

        let newStockUsed = +consumable.stockUsed + parseFloat(quantityUsed);
        let newStockWasted = +consumable.stockWasted + parseFloat(quantityWasted);
        let newAvailable = +consumable.stockAvailable - parseFloat(quantityUsed) - parseFloat(quantityWasted);
        newStockUsed = parseFloat(newStockUsed.toFixed(4));
        newStockWasted = parseFloat(newStockWasted.toFixed(4));
        newAvailable = parseFloat(newAvailable.toFixed(4));
        if (newAvailable < 0) {
          errorFlag = true;
          break;
        }
        updateRecordsToBeAdded.push({
          updateId: consumable._id,
          set: {
            stockUsed: newStockUsed,
            stockWasted: newStockWasted,
            stockAvailable: newAvailable,
          },
          updateValue: {
            createdBy: req.body.requestor.requestorId,
            quantityUsed,
            quantityWasted,
            date: req.body.date,
          },
        });
      }

      try {
        if (errorFlag) {
          res.status(500).send('Stock quantities submitted seems to be invalid');
          return;
        }
        const updatePromises = updateRecordsToBeAdded.map(updateItem => BuildingConsumable.updateOne(
          { _id: updateItem.updateId },
          {
            $set: updateItem.set,
            $push: { updateRecord: updateItem.updateValue },
          },
        ).exec());
        Promise.all(updatePromises)
          .then((results) => {
            res.status(200).send({ result: `Successfully posted log for ${results.length} Consumable records.` });
          })
          .catch(error => res.status(500).send(error));
      } catch (err) {
        res.json(err);
      }
    };

    return {
        fetchBMConsumables,
        updateBMConsumableBulk,
    };
  };

module.exports = bmConsumableController;
