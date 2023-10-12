const mongoose = require('mongoose');

const bmMaterialsController = function (ItemMaterial, ItemType) {
  const bmMaterialsList = async function (req, res) {
    try {
      ItemMaterial.find()
      .populate({
        path: 'project',
        select: '_id projectName'
      })
      .populate({
        path: 'inventoryItemType',
        select: '_id name uom totalStock'
      })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(500).send(error))
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
          $push: { purchaseRecord: purchaseRecord },
        },
        { returnDocument: 'after', lean: true }).exec();
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