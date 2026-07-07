const mongoose = require('mongoose');

const VALID_FUEL_TYPES = ['Diesel', 'Biodiesel', 'Gasoline', 'Natural Gas', 'Ethanol'];

// eslint-disable-next-line max-lines-per-function
function bmInventoryTypeController(
  InvType,
  MatType,
  ConsType,
  ReusType,
  ToolType,
  EquipType,
  invTypeHistory,
  InvUnit,
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

  const fetchInvUnits = async (req, res) => {
    try {
      const units = await InvUnit.find();
      res.status(200).send(units);
    } catch (err) {
      res.status(500).send(err);
    }
  };

  const deleteById = (Model) => async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await Model.findByIdAndDelete(id);

      if (!deleted) {
        return res.status(404).json({ message: 'Item not found' });
      }

      return res.status(200).json({
        message: 'Deleted successfully',
        id,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  const updateInventoryTypeById = (Model) => async (req, res) => {
    try {
      const { id } = req.params;
      const updatedData = {};
      if (req.body.name) updatedData.name = req.body.name;
      if (req.body.description) updatedData.description = req.body.description;

      const updated = await Model.findByIdAndUpdate(id, updatedData, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        return res.status(404).json({ message: 'Item not found' });
      }

      res.status(200).json({
        message: 'Updated successfully',
        item: updated,
      });
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
              .then((results) => {
                res.status(201).send(results);
                if (req.body.customUnit) {
                  InvUnit.create({ unit: req.body.customUnit, category: 'Material' }).catch((e) =>
                    console.error('Error saving custom unit:', e),
                  );
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
    const finalFuelType = fuelType && VALID_FUEL_TYPES.includes(fuelType) ? fuelType : 'Diesel';

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

  async function addReusableType(req, res) {
    const {
      name,
      description,
      requestor: { requestorId },
    } = req.body;
    try {
      ReusType.find({ name })
        .then((result) => {
          if (result.length) {
            res.status(409).send();
          } else {
            const newDoc = {
              category: 'Reusable',
              name,
              description,
              createdBy: requestorId,
            };
            ReusType.create(newDoc)
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

  const addInvUnit = async (req, res) => {
    // NOTE: category is default to be Material as no other item types need units
    const { unit, category = 'Material' } = req.body;
    if (typeof unit !== 'string' || unit.length === 0) {
      res.status(400).json('Invalid unit');
      return;
    }

    try {
      const duplicate = await InvUnit.findOne({ unit });
      if (duplicate) {
        res.status(409).json({ error: 'Unit already exists' });
        return;
      }

      await InvUnit.create({ unit, category });
      const updatedUnits = await InvUnit.find();
      res.status(201).send(updatedUnits);
    } catch (err) {
      res.status(500).send(err);
    }
  };

  const deleteInvUnit = async (req, res) => {
    const { unit } = req.body;
    if (typeof unit !== 'string' || unit.length === 0) {
      res.status(400).json('Invalid unit');
      return;
    }

    try {
      const existing = await InvUnit.findOne({ unit });
      if (!existing) {
        res.status(400).json('Unit does not exist');
        return;
      }

      await InvUnit.deleteOne({ unit });
      const updatedUnits = await InvUnit.find();
      res.status(200).send(updatedUnits);
    } catch (err) {
      res.status(500).send(err);
    }
  };

  const updateSingleInvType = async (req, res) => {
    const { type, invtypeId } = req.params;
    const { name, description, unit, fuel } = req.body;

    try {
      if (type === 'materials') {
        if (name?.trim() === '' || description?.trim() === '' || unit?.trim() === '') {
          return res.status(400).json({ error: 'Name, description, and unit are required.' });
        }

        const updatedMaterialType = await MatType.findByIdAndUpdate(
          invtypeId,
          { name, description, unit },
          { new: true, runValidators: true },
        );
        if (!updatedMaterialType) {
          return res.status(404).json({ error: 'Material does not exist' });
        }

        res.status(200).json(updatedMaterialType);
      } else if (type === 'consumables') {
        if (name?.trim() === '' || description?.trim() === '' || unit?.length === '') {
          return res.status(400).json({ error: 'Name, description, and unit are required.' });
        }

        const updatedConsumableType = await ConsType.findByIdAndUpdate(
          invtypeId,
          { name, description, unit },
          { new: true, runValidators: true },
        );
        if (!updatedConsumableType) {
          return res.status(404).json({ error: 'Consumable does not exist' });
        }

        res.status(200).json(updatedConsumableType);
      } else if (type === 'equipments') {
        if (name?.trim() === '' || description?.trim() === '' || fuel?.trim() === '') {
          return res.status(400).json({ error: 'Name, description, and fuel type are required.' });
        }
        const updatedEquipType = await EquipType.findByIdAndUpdate(
          invtypeId,
          { name, description, fuelType: fuel },
          { new: true, runValidators: true },
        );
        if (!updatedEquipType) {
          return res.status(404).json({ error: 'Equipment does not exist' });
        }

        res.status(200).json(updatedEquipType);
      } else if (type === 'reusables') {
        if (name?.trim() === '' || description?.trim() === '') {
          return res.status(400).json({ error: 'Name and description are required.' });
        }

        const updatedReusType = await ReusType.findByIdAndUpdate(
          invtypeId,
          { name, description },
          { new: true, runValidators: true },
        );
        if (!updatedReusType) {
          return res.status(404).json({ error: 'Reusable does not exist' });
        }

        res.status(200).json(updatedReusType);
      } else if (type === 'tools') {
        if (name?.trim() === '' || description?.trim() === '') {
          return res.status(400).json({ error: 'Name and description are required.' });
        }

        const updatedToolType = await ToolType.findByIdAndUpdate(
          invtypeId,
          { name, description },
          { new: true, runValidators: true },
        );
        if (!updatedToolType) {
          return res.status(404).json({ error: 'Reusable does not exist' });
        }

        res.status(200).json(updatedToolType);
      }
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: `Invalid fuel type. Please choose ${VALID_FUEL_TYPES.join(', ')}.`,
        });
      }

      res.status(500).send(error);
    }
  };

  const deleteSingleInvType = async (req, res) => {
    const { type, invtypeId } = req.params;

    try {
      let deletedResult;
      let updatedList;

      // Handle different types with their respective models
      if (type === 'equipments') {
        deletedResult = await EquipType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'Equipment does not exist' });
          return;
        }
        updatedList = await EquipType.find();
      } else if (type === 'materials') {
        deletedResult = await MatType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'Material does not exist' });
          return;
        }
        updatedList = await MatType.find();
      } else if (type === 'consumables') {
        deletedResult = await ConsType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'Consumables does not exist' });
          return;
        }
        updatedList = await ConsType.find();
      } else if (type === 'tools') {
        deletedResult = await ToolType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'Tool does not exist' });
          return;
        }
        updatedList = await ToolType.find();
      } else if (type === 'reusables') {
        deletedResult = await ReusType.findByIdAndDelete(invtypeId);
        if (!deletedResult) {
          res.status(404).json({ error: 'Reusable does not exist' });
          return;
        }
        updatedList = await ReusType.find();
      } else {
        throw new Error(
          `Unsupported inventory type: "${type}". Expected one of: materials, consumables, tools, reusables, equipments.`,
        );
      }
      // send the updated list
      res.status(200).json(updatedList);
    } catch (error) {
      res.status(400).send(error.message);
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
    fetchInvUnits,
    addInvUnit,
    deleteInvUnit,
    fetchInventoryByType,
    fetchInvTypeHistory,
    deleteInvType: deleteById(InvType),
    updateInvType: updateInventoryTypeById(InvType),
    deleteSingleInvType,
    updateSingleInvType,
  };
}

module.exports = bmInventoryTypeController;
