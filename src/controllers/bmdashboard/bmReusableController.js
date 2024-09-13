const mongoose = require('mongoose');
const {
    reusableType: ReusableType,
} = require('../../models/bmdashboard/buildingInventoryType');

// function isValidDate(dateString) {
//     const date = new Date(dateString);
//     return !isNaN(date.getTime());
// }

const bmReusableController = function (BuildingReusable) {
    const fetchBMReusables = async (req, res) => {
        try {
            BuildingReusable
                .find()
                .populate([
                    {
                        path: 'project',
                        select: '_id name',
                    },
                    {
                        path: 'itemType',
                        select: '_id name',
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
                .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const purchaseReusable = async (req, res) => {
        const {
            primaryId: projectId,
            secondaryId: itemTypeId,
            quantity,
            priority,
            brand: brandPref,
            requestor: { requestorId },
        } = req.body;

        try {
            if (!mongoose.Types.ObjectId.isValid(itemTypeId) || !mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).send('Invalid itemTypeId or projectId.');
            }

            const itemType = await ReusableType.findById(itemTypeId);
            if (!itemType || itemType.__t !== 'reusable_type') {
                return res.status(400).send('ItemTypeId does not correspond to a valid reusable_type.');
            }

            const allowedPriorities = ['Low', 'Medium', 'High'];
            if (!allowedPriorities.includes(priority)) {
              return res.status(400).send('Invalid priority. Must be one of: Low, Medium, High.');
            }

            const newPurchaseRecord = {
                date: new Date(),
                requestedBy: requestorId,
                quantity,
                priority,
                brandPref,
            };

            const doc = await BuildingReusable.findOne({ project: projectId, itemType: itemTypeId });

            if (!doc) {
                const newDoc = new BuildingReusable({
                    itemType: itemTypeId,
                    project: projectId,
                    purchaseRecord: [newPurchaseRecord],
                });
                await newDoc.save();
                res.status(201).send('New reusable purchase record created successfully');
            } else {
                await BuildingReusable.findByIdAndUpdate(
                    { _id: mongoose.Types.ObjectId(doc._id) },
                    { $push: { purchaseRecord: newPurchaseRecord } },
                );
                res.status(201).send('Reusable purchase record updated successfully');
            }
        } catch (error) {
            console.error('Error processing reusable purchase:', error);
            res.status(500).send('Internal Server Error');
        }
    };

    const bmPostReusableUpdateRecord = function (req, res) {
        const payload = req.body;
        let quantityUsed = +req.body.quantityUsed;
        let quantityWasted = +req.body.quantityWasted;
        const { reusable } = req.body;
        if (payload.QtyUsedLogUnit === "percent" && quantityWasted >= 0) {
          quantityUsed = +((+quantityUsed / 100) * reusable.stockAvailable).toFixed(
            4
          );
        }
        if (payload.QtyWastedLogUnit === "percent" && quantityUsed >= 0) {
          quantityWasted = +(
            (+quantityWasted / 100) *
            reusable.stockAvailable
          ).toFixed(4);
        }
    
        if (
          quantityUsed > reusable.stockAvailable ||
          quantityWasted > reusable.stockAvailable ||
          quantityUsed + quantityWasted > reusable.stockAvailable
        ) {
          res
            .status(500)
            .send(
              "Please check the used and wasted stock values. Either individual values or their sum exceeds the total stock available."
            );
        } else {
          let newStockUsed = +reusable.stockUsed + parseFloat(quantityUsed);
          let newStockWasted = +reusable.stockWasted + parseFloat(quantityWasted);
          let newAvailable =
            +reusable.stockAvailable -
            parseFloat(quantityUsed) -
            parseFloat(quantityWasted);
          newStockUsed = parseFloat(newStockUsed.toFixed(4));
          newStockWasted = parseFloat(newStockWasted.toFixed(4));
          newAvailable = parseFloat(newAvailable.toFixed(4));
          BuildingReusable.updateOne(
            { _id: req.body.reusable._id },
    
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
                  quantityUsed,
                  quantityWasted,
                },
              },
            }
          )
            .then((results) => {
              res.status(200).send(results);
            })
            .catch((error) => res.status(500).send({ message: error }));
        }
      };
    
      const bmPostReusableUpdateBulk = function (req, res) {
        const reusableUpdates = req.body.upadateReusables;
        let errorFlag = false;
        const updateRecordsToBeAdded = [];
        for (let i = 0; i < reusableUpdates.length; i+=1) {
          const payload = reusableUpdates[i];
          let quantityUsed = +payload.quantityUsed;
          let quantityWasted = +payload.quantityWasted;
          const { reusable } = payload;
          if (payload.QtyUsedLogUnit === "percent" && quantityWasted >= 0) {
            quantityUsed = +(
              (+quantityUsed / 100) *
              reusable.stockAvailable
            ).toFixed(4);
          }
          if (payload.QtyWastedLogUnit === "percent" && quantityUsed >= 0) {
            quantityWasted = +(
              (+quantityWasted / 100) *
              reusable.stockAvailable
            ).toFixed(4);
          }
    
          let newStockUsed = +reusable.stockUsed + parseFloat(quantityUsed);
          let newStockWasted = +reusable.stockWasted + parseFloat(quantityWasted);
          let newAvailable =
            +reusable.stockAvailable -
            parseFloat(quantityUsed) -
            parseFloat(quantityWasted);
          newStockUsed = parseFloat(newStockUsed.toFixed(4));
          newStockWasted = parseFloat(newStockWasted.toFixed(4));
          newAvailable = parseFloat(newAvailable.toFixed(4));
          if (newAvailable < 0) {
            errorFlag = true;
            break;
          }
          updateRecordsToBeAdded.push({
            updateId: reusable._id,
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
            res.status(500).send("Stock quantities submitted seems to be invalid");
            return;
          }
          const updatePromises = updateRecordsToBeAdded.map((updateItem) =>
            BuildingReusable.updateOne(
              { _id: updateItem.updateId },
              {
                $set: updateItem.set,
                $push: { updateRecord: updateItem.updateValue },
              }
            ).exec()
          );
          Promise.all(updatePromises)
            .then((results) => {
              res.status(200).send({
                result: `Successfully posted log for ${results.length} Reusable records.`,
              });
            })
            .catch((error) => res.status(500).send(error));
        } catch (err) {
          res.json(err);
        }
      };
            
            
            

    return {
        fetchBMReusables,
        purchaseReusable,
        bmPostReusableUpdateRecord,
        bmPostReusableUpdateBulk,
    };
};

module.exports = bmReusableController;
