const mongoose = require('mongoose');

const bmToolsController = function (buildingTool) {
  const bmPurchaseTools = async function (req, res) {
    const {
      projectId,
      toolId,
      quantity,
      priority,
      brand,
      requestor: { requestorId },
    } = req.body;
    const newPurchaseRecord = {
      quantity,
      priority,
      brand,
      requestedBy: requestorId,
    };
    try {
      const doc = await buildingTool.findOne({ project: projectId, itemType: toolId });
      if (!doc) {
        const newDoc = {
          itemType: toolId,
          project: projectId,
          purchaseRecord: [newPurchaseRecord],
        };
        buildingTool
        .create(newDoc)
        .then(() => res.status(201).send())
        .catch(error => res.status(500).send(error));
        return;
      }
      buildingTool
      .findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(doc._id) },
          { $push: { purchaseRecord: newPurchaseRecord } },
          )
        .exec()
        .then(() => res.status(201).send())
        .catch(error => res.status(500).send(error));
    } catch (error) {
      res.status(500).send(error);
    }
  };
  return {
    bmPurchaseTools
    };
};

module.exports = bmToolsController;