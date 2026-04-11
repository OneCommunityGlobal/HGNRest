const mongoose = require('mongoose');

function bmInventoryTypeController(
  InvType,
  MatType,
  ConsType,
  ReusType,
  ToolType,
  EquipType,
  BuildingUnit,
  invTypeHistory,
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
    const { name, description, fuel: fuelType, requestor } = req.body;

    const requestorId = requestor?.requestorId || null;

    // Validate and set default fuel type if not provided
    const validFuelTypes = ['Diesel', 'Biodiesel', 'Gasoline', 'Natural Gas', 'Ethanol'];
    const finalFuelType = fuelType && validFuelTypes.includes(fuelType) ? fuelType : 'Diesel';

    try {
      EquipType.find({ name })
        .then((result) => {
          if (result.length) {
            res.status(409).json({ error: `Equipment with name "${name}" already exists.` });
          } else {
            const newDoc = {
              category: 'Equipment',
              name,
              description,
              fuelType: finalFuelType,
              createdBy: requestorId,
            };
            EquipType.create(newDoc)
              .then(() => res.status(201).send())
              .catch((error) => {
                if (error._message && error._message.includes('validation failed')) {
                  res.status(400).json({ error: 'Validation failed. Please check your input.' });
                } else {
                  res.status(500).json({ error: 'Failed to create equipment. Please try again.' });
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
      const {
        name,
        unit,
        type: rawType,
        requestor: { requestorId },
      } = req.body;
      const historyDocs = [];
      const updateData = {};
      // Selection of Collection depending on Type
      const allowedTypes = ['Material', 'Consumable'];
      const itemTtype = allowedTypes.includes(rawType) ? rawType : 'Inventory';

      // Validate invtypeId
      if (!mongoose.Types.ObjectId.isValid(invtypeId)) {
        return res.status(400).json({ message: 'Invalid inventory type ID' });
      }
      // Sanitize name
      const safeName = String(name).trim();
      if (!safeName) {
        return res.status(400).json({ message: 'Invalid inventory name' });
      }
      // Extract and sanitize
      const safeUnit = String(unit).trim();
      if (!safeUnit || safeUnit.length > 50) {
        return res.status(400).json({ message: 'Invalid unit value' });
      }

      let CollectionName = InvType;
      if (itemTtype === 'Material') {
        CollectionName = MatType;
      } else if (itemTtype === 'Consumable') {
        CollectionName = ConsType;
      }

      // Fetch existing document
      const invType = await CollectionName.findById(invtypeId);
      if (!invType) {
        return res.status(404).send('Inventory type not found check Id');
      }

      // Perform query using sanitized values
      const existingInvType = await CollectionName.findOne({
        name: safeName,
        _id: { $ne: mongoose.Types.ObjectId(invtypeId) },
      });

      if (existingInvType) {
        return res.status(409).json({
          message: 'Inventory type name already exists',
        });
      }

      // Track name change
      if (safeName && safeName !== invType.name) {
        historyDocs.push({
          invtypeId,
          field: 'name',
          oldValue: invType.name,
          newValue: safeName,
          editedBy: requestorId,
        });
        updateData.name = safeName;
      }

      // Track unit change
      if (safeUnit && safeUnit !== invType.unit) {
        historyDocs.push({
          invtypeId,
          field: 'unit',
          oldValue: invType.unit,
          newValue: safeUnit,
          editedBy: requestorId,
        });
        updateData.unit = safeUnit;
      }

      //  Save history (if any)
      if (historyDocs.length > 0) {
        await invTypeHistory.insertMany(historyDocs);
      }

      // Update main document
      const updatedInvType = await CollectionName.findByIdAndUpdate(invtypeId, updateData, {
        new: true,
        runValidators: true,
      });

      res.status(200).json(updatedInvType);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
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

  const updateSingleInvType = async (req, res) => {
    const { type, invtypeId } = req.params;
    const { name, description, unit, fuel } = req.body;

    // Handle Equipment type specifically
    if (type === 'Equipments') {
      // send back errors if required fields are missing
      if (name?.length === 0 || description?.length === 0) {
        res.status(400).json({ error: 'Name and description are required.' });
        return;
      }

      try {
        // find Equipment by id, and update name, description, fuelType
        const updatedEquipType = await EquipType.findByIdAndUpdate(
          invtypeId,
          { name, description, fuelType: fuel },
          { new: true, runValidators: true },
        );
        if (!updatedEquipType) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }

        res.status(200).json(updatedEquipType);
      } catch (error) {
        res.status(500).send(error);
      }
    } else if (type === 'Materials') {
      // Handle Material type with unit field
      // send back errors if required fields are missing
      if (name?.length === 0 || description?.length === 0 || unit?.length === 0) {
        res.status(400).json({ error: 'Name, description, and unit are required.' });
        return;
      }

      try {
        // find Material by id, and update name, description, unit
        const updatedMaterialType = await MatType.findByIdAndUpdate(
          invtypeId,
          { name, description, unit },
          { new: true, runValidators: true },
        );
        if (!updatedMaterialType) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }

        res.status(200).json(updatedMaterialType);
      } catch (error) {
        res.status(500).send(error);
      }
    } else if (type === 'Consumables') {
      // Handle Consumable type with unit field
      // send back errors if required fields are missing
      if (name?.length === 0 || description?.length === 0 || unit?.length === 0) {
        res.status(400).json({ error: 'Name, description, and unit are required.' });
        return;
      }

      try {
        // find Consumable by id, and update name, description, unit
        const updatedConsumableType = await ConsType.findByIdAndUpdate(
          invtypeId,
          { name, description, unit },
          { new: true, runValidators: true },
        );
        if (!updatedConsumableType) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }

        res.status(200).json(updatedConsumableType);
      } catch (error) {
        res.status(500).send(error);
      }
    } else {
      // Handle other types (Reusables, Tools) with original logic
      // send back errors if required fields are missing
      if (name?.length === 0 || description?.length === 0) {
        res.status(400).json({ error: 'Name and description are required.' });
        return;
      }

      try {
        // find invType by id, and update name, description
        const updatedInvType = await InvType.findByIdAndUpdate(
          invtypeId,
          { name, description },
          { new: true, runValidators: true },
        );
        if (!updatedInvType) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }

        res.status(200).json(updatedInvType);
      } catch (error) {
        res.status(500).send(error);
      }
    }
  };

  const deleteSingleInvType = async (req, res) => {
    const { type, invtypeId } = req.params;

    try {
      let deletedResult;
      let updatedList;

      // Handle different types with their respective models
      if (type === 'Equipments') {
        deletedResult = await EquipType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }
        updatedList = await EquipType.find();
      } else if (type === 'Materials') {
        deletedResult = await MatType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }
        updatedList = await MatType.find();
      } else if (type === 'Consumables') {
        deletedResult = await ConsType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }
        updatedList = await ConsType.find();
      } else if (type === 'Tools') {
        deletedResult = await ToolType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }
        updatedList = await ToolType.find();
      } else if (type === 'Reusables') {
        deletedResult = await ReusType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }
        updatedList = await ReusType.find();
      } else {
        // Fallback to InvType for unknown types
        deletedResult = await InvType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'invTypeId does not exist' });
          return;
        }
        updatedList = await InvType.find({ category: type });
      }

      // send the updated list
      res.status(200).json(updatedList);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const fetchInvTypeHistory = async (req, res) => {
    try {
      const { invtypeId } = req.params;
      const safeInvTypeId = new mongoose.Types.ObjectId(invtypeId);
      if (!mongoose.Types.ObjectId.isValid(invtypeId)) {
        return res.status(400).json({ message: 'Invalid inventory type id' });
      }

      const history = await invTypeHistory
        .find({ invtypeId: safeInvTypeId })
        .populate('editedBy', '_id firstName lastName email')
        .sort({ editedAt: -1 })
        .lean();

      res.status(200).json(history);
    } catch (error) {
      console.error('Fetch history error:', error);
      res.status(500).json({ message: 'Failed to fetch inventory history' });
    }
  };

  return {
    fetchMaterialTypes,
    fetchConsumableTypes,
    fetchReusableTypes,
    fetchToolTypes,
    addEquipmentType,
    fetchEquipmentTypes,
    addReusableType,
    fetchSingleInventoryType,
    addMaterialType,
    addConsumableType,
    addToolType,
    updateNameAndUnit,
    fetchInvUnitsFromJson,
    fetchInventoryByType,
    addInventoryUnit,
    deleteInventoryUnit,
    updateSingleInvType,
    deleteSingleInvType,
    fetchInvTypeHistory,
  };
}

module.exports = bmInventoryTypeController;
