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
    // if new material or new measurement, add to inventoryItemType collection first
    const { material, requestor } = req.body;
    if (material.newMaterial || material.newMeasurement) {
      const materials = await ItemMaterial.find().exec();
      console.log(materials);
      
    }
    // then either add item material to project or update existing item material
  };

  return { 
    bmMaterialsList,
    bmAddMaterials 
  };
};

module.exports = bmMaterialsController;