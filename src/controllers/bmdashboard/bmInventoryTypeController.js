function bmInventoryTypeController(InvType, MatType, ConsType, ReusType, ToolType, EquipType) {
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

  async function fetchInventoryByType(req, res) {
    const { type } = req.params;
    let SelectedType = InvType;
    if(type == 'Materials'){
      SelectedType = MatType
    }
    else if(type == 'Consumables'){
      SelectedType = ConsType
    }
    else if(type == 'Reusables'){
      SelectedType = ReusType
    }
    else if(type == 'Tools'){
      SelectedType = ToolType
    }
    else if(type == 'Equipments'){
      SelectedType = EquipType
    }
    try {
      SelectedType
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
    const fetchSingleInventoryType = async (req, res) => {
      const { invtypeId } = req.params;
      try {
        const result = await InvType.findById(invtypeId).exec();
        res.status(200).send(result);
      } catch (error) {
        res.status(500).send(error);
      }
    };

    const updateNameAndUnit = async (req, res) => {
      try {
        const { invtypeId } = req.params;
        const { name, unit } = req.body;

        const updateData = {};

        if (name) {
          updateData.name = name;
        }

        if (unit) {
          updateData.unit = unit;
        }

        const updatedInvType = await InvType.findByIdAndUpdate(
          invtypeId,
          updateData,
          { new: true, runValidators: true },
        );

        if (!updatedInvType) {
          return res.status(404).json({ error: 'invType Material not found check Id' });
        }

        res.status(200).json(updatedInvType);
      } catch (error) {
        res.status(500).send(error);
      }
    };
  return {
    fetchMaterialTypes,
    addEquipmentType,
    fetchSingleInventoryType,
    updateNameAndUnit,
    fetchInventoryByType
  };
}

module.exports = bmInventoryTypeController;
