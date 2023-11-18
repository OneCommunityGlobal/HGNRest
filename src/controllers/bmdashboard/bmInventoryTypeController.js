const mongoose = require('mongoose');

const bmInventoryTypeController = function (BuildingInventoryType) {
  const buildingInventoryTypeList = async function _matTypeList(req, res) {
    try {
       BuildingInventoryType.find({'category':'Material'})
      .exec()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const addBuildingInventoryType = async function _matTypeList(req, res) {
    try {
      const inventoryTypeObject = new BuildingInventoryType();
      inventoryTypeObject.category = 'Material';
      inventoryTypeObject.name = req.body.name;
      inventoryTypeObject.description = req.body.description;
      inventoryTypeObject.unit =  req.body.unit || req.body.customUnit;
      inventoryTypeObject.save()
      .then(results => res.status(201).send(results))
      .catch(errors => res.status(500).send(errors));
    } catch (err) {
      res.json(err);
    }
  };
  return { buildingInventoryTypeList , addBuildingInventoryType };
};

module.exports = bmInventoryTypeController;
