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
    console.log(req.body);
    const { material, requestor } = req.body;
    let itemTypeId = material.material; // if new material: material name / else: itemType id
    
    // if new material or new measurement, add new inventoryItemType
    if (material.newMaterial || material.newMeasurement) {
      try {
        const itemType = new ItemType({
          type: 'material',
          name: material.material,
          description: material.description,
          uom: material.measurement,
          totalStock: material.quantity,
          totalAvailable: material.quantity,
          projectsUsing: [material.projectId],
          imageUrl: '',
          link: material.link,
        });
        const newItemType = await itemType.save();
        itemTypeId = newItemType._id;
      } catch (err) {
        res.status(400).send({ error: 'Error saving new material type'});
      }
    }

    try {
      const invMaterial = await ItemMaterial.find({ id: material.projectId, inventoryItemType: itemTypeId }).exec();
      // if material already exists in project, add to it
      // else, create new material for project
      if (invMaterial) {
        // TODO
        console.log(invMaterial);
      } else {
        const itemMaterial = new ItemMaterial({
          inventoryItemType: itemTypeId,
          project: material.projectId,
          stockBought: material.quantity,
          stockAvailable: material.quantity,
          usageRecord: [],
          updateRecord: [],
          purchaseRecord: [{
            date: material.purchaseDate,
            createdBy: req.requestor.requestorId,
            poId: material.invoice,
            sellerId: material.phone,
            quantity: material.quantity,
            unitPrice: material.unitPrice,
            subTotal: material.quantity * material.unitPrice,
            tax: material.taxRate,
            shipping: material.shippingFee,
          }],
        });
        const newItemMaterial = await itemMaterial.save();
      }
    } catch (err) {
      res.status(400).send({ error: 'Error adding new material to project'});
    }
  };

  return { 
    bmMaterialsList,
    bmAddMaterials 
  };
};

module.exports = bmMaterialsController;