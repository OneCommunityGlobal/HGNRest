// Constants for magic strings
const PERCENT_UNIT = 'percent';

// Helper function to calculate new quantities with truncation applied conditionally
function calculateNewQuantity(quantity, unit, stockAvailable, applyTruncation = false) {
  let result = quantity;
  if (unit === PERCENT_UNIT) {
    result = (quantity / 100) * stockAvailable;
    if (applyTruncation) {
      result = truncateNumber(result, 4);
    }
  }
  return result;
}

// Utility function for truncating numbers to a specified number of decimal places
function truncateNumber(num, decimalPlaces = 4) {
  const factor = Math.pow(10, decimalPlaces);
  return Math.trunc(num * factor) / factor;
}

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
    const updateBMConsumableBulk = async function (req, res) {
      const { updateConsumables, requestor, date } = req.body;
      const updateRecordsToBeAdded = [];
      let errorMessage = '';
  
      for (const payload of updateConsumables) {
        const { quantityUsed: rawQuantityUsed, quantityWasted: rawQuantityWasted, consumable, QtyUsedLogUnit, QtyWastedLogUnit } = payload;
  
        // Extract payload details
        const applyRounding = payload.QtyUsedLogUnit === PERCENT_UNIT || payload.QtyWastedLogUnit === PERCENT_UNIT;
  
        // Calculate quantities with potential rounding
        let quantityUsed = calculateNewQuantity(Number(rawQuantityUsed), QtyUsedLogUnit, consumable.stockAvailable, applyRounding);
        let quantityWasted = calculateNewQuantity(Number(rawQuantityWasted), QtyWastedLogUnit, consumable.stockAvailable, applyRounding);
  
        // Assuming applyTruncation is true when you want to truncate the numbers
        let newStockUsed = truncateNumber(consumable.stockUsed + quantityUsed, 4);
        let newStockWasted = truncateNumber(consumable.stockWasted + quantityWasted, 4);
        let newAvailable = truncateNumber(consumable.stockAvailable - quantityUsed - quantityWasted, 4);
  
        // Validate new stock availability
        if (newAvailable < 0) {
          errorMessage = `Stock quantities for consumable ${consumable._id} would become negative.`;
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
            createdBy: requestor.requestorId,
            quantityUsed,
            quantityWasted,
            date,
          },
        });
      }
  
      // Check for accumulated errors before proceeding
      if (errorMessage) {
        return res.status(400).send(errorMessage);
      }
  
      try {
        const updatePromises = updateRecordsToBeAdded.map(updateItem =>
          BuildingConsumable.updateOne(
            { _id: updateItem.updateId },
            {
              $set: updateItem.set,
              $push: { updateRecord: updateItem.updateValue },
            }
          ).exec()
        );
  
        const results = await Promise.all(updatePromises);
        res.status(200).send({ result: `Successfully posted log for ${results.length} Consumable records.` });
      } catch (error) {
        res.status(500).send(`Error updating consumable records: ${error.message}`);
      }
    };

  return {
    fetchBMConsumables,
    updateBMConsumableBulk,
  };
};

module.exports = bmConsumableController;