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
    try {
      EquipType
        .find({ name })
        .then((result) => {
          if (result.length) {
            res.status(409).send();
          } else {
            const newDoc = {
              category: 'Equipment',
              name,
              description,
              fuelType,
              createdBy: requestorId,
            };
            EquipType
            .create(newDoc)
            .then(() => res.status(201).send())
            .catch((error) => {
              if (error._message.includes('validation failed')) {
                res.status(400).send(error);
              } else {
                res.status(500).send(error);
              }
            });
          }
        })
        .catch(error => res.status(500).send(error));
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
