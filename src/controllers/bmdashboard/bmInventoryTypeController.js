function bmInventoryTypeController(MatType, ConsType, ReusType, ToolType, EquipType) {
  async function fetchMaterialTypes(req, res) {
    try {
      MatType
        .find()
        .exec()
        .then(result => res.status(200).send(result))
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  }

  async function addEquipmentType(req, res) {
    const {
      name,
      desc: description,
      fuel: fuelType,
      requestor: { requestorId },
    } = req.body;
    const newDoc = {
      category: 'Equipment',
      name,
      description,
      fuelType,
      createdBy: requestorId,
    };
    try {
      EquipType
        .create(newDoc)
        .then(() => res.status(201).send())
        .catch((error) => {
          if (error._message.includes('validation failed')) {
            res.status(400).send(error);
          }
          res.status(500).send(error);
        });
    } catch (error) {
      res.status(500).send(error);
    }
  }
  return {
    fetchMaterialTypes,
    addEquipmentType,
  };
}


module.exports = bmInventoryTypeController;
