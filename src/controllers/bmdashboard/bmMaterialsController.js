const mongoose = require('mongoose');

// use in bmPurchaseMaterials auth check (see below)
// const buildingProject = require('../../models/bmdashboard/buildingProject');

const bmMaterialsController = function (ItemMaterial, BuildingMaterial) {
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

  const bmPurchaseMaterials = async function (req, res) {
    console.log(BuildingMaterial);
    console.log(req.body);
    const {
      projectId,
      matTypeId,
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
      // check if requestor has permission to make purchase request
      //! Note: this code is disabled until permissions are added
      // TODO: uncomment this code to execute auth check
      // const { buildingManager: bmId } = await buildingProject.findById(projectId, 'buildingManager').exec();
      // if (bmId !== requestorId) {
      //   res.status(403).send({ message: 'You are not authorized to edit this record.' });
      //   return;
      // }

      // check if the material is already being used in the project
      // if no, add a new document to the collection
      // if yes, update the existing document
      const doc = await BuildingMaterial.findOne({ project: projectId, itemType: matTypeId });
      if (!doc) {
        const newDoc = {
          itemType: matTypeId,
          project: projectId,
          purchaseRecord: [newPurchaseRecord],
        };
      BuildingMaterial
      .create(newDoc)
      .then((result) => {
        console.log('result new: ', result);
        res.status(201).send();
      })
      .catch(error => res.status(500).send(error));
      return;
      }
      BuildingMaterial
        .findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(doc._id) },
          { $push: { purchaseRecord: newPurchaseRecord } },
          )
        .exec()
        .then((result) => {
          console.log('result old: ', result);
          res.status(201).send();
        })
        .catch(error => res.status(500).send(error));
    } catch (error) {
      res.status(500).send(error);
    }
  };
  return {
    bmMaterialsList,
    bmPurchaseMaterials,
  };
};

module.exports = bmMaterialsController;
