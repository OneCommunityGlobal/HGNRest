// const mongoose = require('mongoose')

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

  const bmAddMaterials = async function (req, res) {
    // add permission check...

    const { material, requestor } = req.body;
    const purchaseRecord = {
      date: material.purchaseDate,
      createdBy: requestor.requestorId,
      poId: material.invoice,
      sellerId: material.phone,
      quantity: material.quantity,
      unitPrice: material.unitPrice,
      currency: material.currency,
      subtotal: material.quantity,
      tax: material.taxRate,
      shipping: material.shippingFee,
    };

    try {
      const result = await ItemMaterial.findOneAndUpdate(
        { project: material.projectId, inventoryItemType: material.material },
        {
          $inc: { stockBought: material.quantity, stockAvailable: material.quantity },
          $push: { purchaseRecord },
        },
        { returnDocument: 'after', lean: true },
        )
        .exec();
      if (result) {
        console.log(result);
        res.status(201).send(result);
      } else {
        const itemMaterial = new ItemMaterial({
          inventoryItemType: material.material,
          project: material.projectId,
          stockBought: material.quantity,
          stockAvailable: material.quantity,
          usageRecord: [],
          updateRecord: [],
          purchaseRecord: [purchaseRecord],
        });
        const newItemMaterial = await itemMaterial.save();
        res.status(201).send(newItemMaterial);
      }
    } catch (error) {
      res.status(500).send(error);
    }
  };

  return {
    bmMaterialsList,
    bmAddMaterials,
  };
};

module.exports = bmMaterialsController;
