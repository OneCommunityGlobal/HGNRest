// const mongoose = require('mongoose');

function bmEquipmentController() {
  async function addEquipmentType(req, res) {
    console.log(req.body);
    try {
      res.status(201).send({ message: 'Hello world!' });
    } catch (error) {
      res.status(500).send(error);
    }
  }
  return {
    addEquipmentType,
  };
}

module.exports = bmEquipmentController;
