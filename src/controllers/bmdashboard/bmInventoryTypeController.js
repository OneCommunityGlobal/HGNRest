function bmInventoryTypeController(
  InvType,
  MatType,
  ConsType,
  ReusType,
  ToolType,
  EquipType,
  BuildingUnit,
) {
  async function fetchMaterialTypes(req, res) {
    try {
      MatType.find()
        .exec()
        .then((result) => res.status(200).send(result))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  }

  async function fetchReusableTypes(req, res) {
    try {
      ReusType.find()
        .exec()
        .then((result) => res.status(200).send(result))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  }

  const fetchToolTypes = async (req, res) => {
    try {
      ToolType.find()
        .populate([
          {
            path: 'available',
            select: '_id code project',
            populate: {
              path: 'project',
              select: '_id name',
            },
          },
          {
            path: 'using',
            select: '_id code project',
            populate: {
              path: 'project',
              select: '_id name',
            },
          },
        ])
        .exec()
        .then((result) => {
          res.status(200).send(result);
        })
        .catch((error) => {
          console.error('fetchToolTypes error: ', error);
          res.status(500).send(error);
        });
    } catch (err) {
      console.log('error: ', err);
      res.json(err);
    }
  };

  const fetchInvUnitsFromJson = async (req, res) => {
    try {
      const units = await BuildingUnit.find().exec();
      res.status(200).send(units);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async function addMaterialType(req, res) {
    const {
      name,
      description,
      requestor: { requestorId },
    } = req.body;
    const unit = req.body.unit || req.body.customUnit;
    try {
      MatType.find({ name })
        .then((result) => {
          if (result.length) {
            res.status(409).send('Oops!! Material already exists!');
          } else {
            const newDoc = {
              category: 'Material',
              name,
              description,
              unit,
              createdBy: requestorId,
            };
            MatType.create(newDoc)
              .then(async (results) => {
                res.status(201).send(results);
                if (req.body.customUnit) {
                  try {
                    const exists = await BuildingUnit.findOne({
                      unit: { $regex: new RegExp(`^${req.body.customUnit}$`, 'i') },
                    });
                    if (!exists) {
                      await BuildingUnit.create({
                        unit: req.body.customUnit,
                        category: 'Material',
                      });
                    }
                  } catch (e) {
                    console.log(e);
                  }
                }
              })
              .catch((error) => {
                if (error._message.includes('validation failed')) {
                  res.status(400).send(error);
                } else {
                  res.status(500).send(error);
                }
              });
          }
        })
        .catch((error) => res.status(500).send(error));
    } catch (error) {
      res.status(500).send(error);
    }
  }

  async function addConsumableType(req, res) {
    const {
      name,
      description,
      unit,
      size,
      requestor: { requestorId },
    } = req.body;

    try {
      ConsType.find({ name })
        .then((result) => {
          if (result.length) {
            res.status(409).send('Oops!! Consumable already exists!');
          } else {
            const newDoc = {
              category: 'Consumable',
              name,
              description,
              unit,
              size,
              createdBy: requestorId,
            };
            ConsType.create(newDoc)
              .then((results) => {
                res.status(201).send(results);
              })
              .catch((error) => {
                if (error._message.includes('validation failed')) {
                  res.status(400).send(error.errors.unit.message);
                } else {
                  res.status(500).send(error);
                }
              });
          }
        })
        .catch((error) => {
          res.status(500).send(error);
        });
    } catch (error) {
      res.status(500).send(error);
    }
  }

  async function addToolType(req, res) {
    const {
      name,
      description,
      invoice,
      purchaseRental,
      fromDate,
      toDate,
      condition,
      phoneNumber,
      quantity,
      currency,
      unitPrice,
      shippingFee,
      taxes,
      totalPriceWithShipping,
      images,
      link,
      requestor: { requestorId },
    } = req.body;

    try {
      ToolType.find({ name })
        .then((result) => {
          if (result.length) {
            res.status(409).send('Oops!! Tool already exists!');
          } else {
            const newDoc = {
              category: 'Tool',
              name,
              description,
              invoice,
              purchaseRental,
              fromDate,
              toDate,
              condition,
              phoneNumber,
              quantity,
              currency,
              unitPrice,
              shippingFee,
              taxes,
              totalPriceWithShipping,
              images,
              link,
              createdBy: requestorId,
            };
            ToolType.create(newDoc)
              .then((results) => {
                res.status(201).send(results);
              })
              .catch((error) => {
                if (error._message.includes('validation failed')) {
                  res.status(400).send(error.errors.unit.message);
                } else {
                  res.status(500).send(error);
                }
              });
          }
        })
        .catch((error) => {
          res.status(500).send(error);
        });
    } catch (error) {
      res.status(500).send(error);
    }
  }

  async function addReusableType(req, res) {
    const {
      name,
      description,
      invoice,
      purchaseRental,
      fromDate,
      toDate,
      condition,
      phoneNumber,
      quantity,
      currency,
      unitPrice,
      shippingFee,
      taxes,
      totalPriceWithShipping,
      images,
      link,
      requestor: { requestorId },
    } = req.body;

    try {
      ReusType.find({ name })
        .then((result) => {
          if (result.length) {
            res.status(409).send('Oops!! Reusable already exists!');
          } else {
            const newDoc = {
              category: 'Reusable',
              name,
              description,
              invoice,
              purchaseRental,
              fromDate,
              toDate,
              condition,
              phoneNumber,
              quantity,
              currency,
              unitPrice,
              shippingFee,
              taxes,
              totalPriceWithShipping,
              images,
              link,
              createdBy: requestorId,
            };
            ReusType.create(newDoc)
              .then((results) => {
                res.status(201).send(results);
              })
              .catch((error) => {
                if (error._message.includes('validation failed')) {
                  res.status(400).send(error.errors.unit.message);
                } else {
                  res.status(500).send(error);
                }
              });
          }
        })
        .catch((error) => {
          res.status(500).send(error);
        });
    } catch (error) {
      res.status(500).send(error);
    }
  }

  async function fetchInventoryByType(req, res) {
    const { type } = req.params;
    let SelectedType = InvType;
    if (type === 'Materials') {
      SelectedType = MatType;
    } else if (type === 'Consumables') {
      SelectedType = ConsType;
    } else if (type === 'Reusables') {
      SelectedType = ReusType;
    } else if (type === 'Tools') {
      SelectedType = ToolType;
    } else if (type === 'Equipments') {
      SelectedType = EquipType;
    }
    try {
      SelectedType.find()
        .exec()
        .then((result) => res.status(200).send(result))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  }

  const fetchConsumableTypes = async (req, res) => {
    try {
      ConsType.find()
        .exec()
        .then((result) => res.status(200).send(result))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  async function addEquipmentType(req, res) {
    const {
      name,
      desc: description,
      fuel: fuelType,
      requestor: { requestorId },
    } = req.body;
    try {
      EquipType.find({ name })
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
            EquipType.create(newDoc)
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
        .catch((error) => res.status(500).send(error));
    } catch (error) {
      res.status(500).send(error);
    }
  }

  async function fetchEquipmentTypes(req, res) {
    try {
      EquipType.find()
        .exec()
        .then((result) => res.status(200).send(result))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
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

      const updatedInvType = await InvType.findByIdAndUpdate(invtypeId, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedInvType) {
        return res.status(404).json({ error: 'invType Material not found check Id' });
      }

      res.status(200).json(updatedInvType);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  // PUT - Update any inventory type by ID (generic)
  const updateInventoryType = async (req, res) => {
    try {
      const { invtypeId } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.__t;
      delete updateData.__v;

      const updatedInvType = await InvType.findByIdAndUpdate(invtypeId, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedInvType) {
        return res.status(404).json({ error: 'Inventory type not found' });
      }

      res.status(200).json(updatedInvType);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // DELETE - Delete any inventory type by ID
  const deleteInventoryType = async (req, res) => {
    try {
      const { invtypeId } = req.params;

      const deletedInvType = await InvType.findByIdAndDelete(invtypeId);

      if (!deletedInvType) {
        return res.status(404).json({ error: 'Inventory type not found' });
      }

      res.status(200).json({ message: 'Inventory type deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const addInventoryUnit = async (req, res) => {
    try {
      const { unit, category } = req.body;

      if (!unit) {
        return res.status(400).json({ error: 'Unit is required' });
      }

      const exists = await BuildingUnit.findOne({
        unit: { $regex: new RegExp(`^${unit}$`, 'i') },
      });
      if (exists) {
        return res.status(409).json({ error: 'Unit already exists' });
      }

      const newUnit = await BuildingUnit.create({ unit, category: category || 'Material' });
      res.status(201).json(newUnit);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const deleteInventoryUnit = async (req, res) => {
    try {
      const { unitName } = req.params;

      if (!unitName) {
        return res.status(400).json({ error: 'Unit identifier is required' });
      }

      let deleted;
      if (unitName.match(/^[0-9a-fA-F]{24}$/)) {
        deleted = await BuildingUnit.findByIdAndDelete(unitName);
      } else {
        const decodedUnitName = decodeURIComponent(unitName);
        deleted = await BuildingUnit.findOneAndDelete({
          unit: { $regex: new RegExp(`^${decodedUnitName}$`, 'i') },
        });
      }

      if (!deleted) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      res.status(200).json({ message: 'Unit deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    fetchMaterialTypes,
    fetchConsumableTypes,
    fetchReusableTypes,
    fetchToolTypes,
    addEquipmentType,
    fetchEquipmentTypes,
    fetchSingleInventoryType,
    updateNameAndUnit,
    addMaterialType,
    addConsumableType,
    addToolType,
    addReusableType,
    fetchInvUnitsFromJson,
    fetchInventoryByType,
    updateInventoryType,
    deleteInventoryType,
    addInventoryUnit,
    deleteInventoryUnit,
  };
}

module.exports = bmInventoryTypeController;
