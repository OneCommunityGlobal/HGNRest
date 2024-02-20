const mongoose = require('mongoose');

const bmToolController = (BuildingTool) => {
    const fetchSingleTool = async (req, res) => {
        const { toolId } = req.params;
        try {
            BuildingTool
                .findById(toolId)
                .populate([
                    {
                        path: 'itemType',
                        select: '_id name description unit imageUrl category',
                    },
                    {
                        path: 'project',
                        select: 'name',
                    },
                    {
                        path: 'userResponsible',
                        select: '_id firstName lastName',
                    },
                    {
                        path: 'purchaseRecord',
                        populate: {
                            path: 'requestedBy',
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
                        path: 'logRecord',
                        populate: [{
                            path: 'createdBy',
                            select: '_id firstName lastName',
                        },
                        {
                            path: 'responsibleUser',
                            select: '_id firstName lastName',
                    }],
                    },
                ])
                .exec()
                .then((tool) => res.status(200).send(tool))
                .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
     };

    const bmPurchaseTools = async function (req, res) {
        const {
          projectId,
          toolId,
          quantity,
          priority,
          estTime: estUsageTime,
          desc: usageDesc,
          makeModel: makeModelPref,
          requestor: { requestorId },
        } = req.body;
        try {
            const newPurchaseRecord = {
                quantity,
                priority,
                estUsageTime,
                usageDesc,
                makeModelPref,
                requestedBy: requestorId,
              };
          const doc = await BuildingTool.findOne({ project: projectId, itemType: toolId });
          if (!doc) {
            const newDoc = {
              itemType: toolId,
              project: projectId,
              purchaseRecord: [newPurchaseRecord],
            };

            BuildingTool
              .create(newDoc)
              .then(() => res.status(201).send())
              .catch((error) => res.status(500).send(error));
              return;
          }

            BuildingTool
              .findOneAndUpdate(
                { _id: mongoose.Types.ObjectId(doc._id) },
                { $push: { purchaseRecord: newPurchaseRecord } },
              )
              .exec()
              .then(() => res.status(201).send())
              .catch((error) => res.status(500).send(error));
        } catch (error) {
          res.status(500).send(error);
        }
      };

      return {
        fetchSingleTool,
        bmPurchaseTools,
      };
};

module.exports = bmToolController;
