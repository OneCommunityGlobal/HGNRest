const fs = require('fs');
const path = require('path');

const filename = 'BuildingUnits.json';
const currentFilePath = __filename;
const rootPath = path.resolve(path.dirname(currentFilePath), '../../../'); // Go up three levels to the root
const filepath = path.join(rootPath, filename);
const { readFile } = fs;
const { writeFile } = fs;

function bmInventoryTypeController(
  InvType,
  MatType,
  ConsType,
  ReusType,
  ToolType,
  EquipType,
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
      console.log(__dirname, filepath);
      readFile(filepath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          res.status(500).send(err);
        }

        try {
          const jsonData = JSON.parse(data);
          res.status(200).send(jsonData);
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          res.status(500).send(parseError);
        }
      });
    } catch (err) {
      res.json(err);
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
                  try {
                    // Add new unit to json file : src\controllers\bmdashboard\BuildingUnits.json
                    const newItem = { unit: req.body.customUnit, category: 'Material' };
                    const newItemString = JSON.stringify(newItem, null, 2);
                    readFile(filepath, 'utf8', (err, data) => {
                      if (err) {
                        console.error('Error reading file:', err);
                        return;
                      }
                      // Remove the last array bracket and comma
                      const updatedContent = data.trim().replace(/\s*]$/, '');

                      // Add a comma and newline if the file is not empty
                      const separator = updatedContent !== '' ? ',\n' : '';
                      const updatedFileContent = `${updatedContent}${separator}${newItemString}\n]`;

                      writeFile(filepath, updatedFileContent, 'utf8', (error) => {
                        if (error) {
                          console.error('Error writing to file:', error);
                        }
                      });
                    });
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
      const {
        name,
        unit,
        type,
        requestor: { requestorId },
      } = req.body;

      // Selection of Collection depending on Type
      let CollectionName = InvType;
      if (type === 'Material') {
        CollectionName = MatType;
      } else if (type === 'Consumable') {
        CollectionName = ConsType;
      }

      // Fetch existing document
      const invType = await CollectionName.findById(invtypeId);
      if (!invType) {
        return res.status(404).send(`invType ${type} not found check Id`);
      }

      // Name uniqueness check
      if (name && name !== invType.name) {
        const existingInvType = await CollectionName.findOne({
          name,
          _id: { $ne: invtypeId },
        });

        if (existingInvType) {
          return res.status(404).send(`${type} name already exists`);
        }
      }

      const historyDocs = [];
      const updateData = {};

      // Track name change
      if (name && name !== invType.name) {
        historyDocs.push({
          invtypeId,
          field: 'name',
          oldValue: invType.name,
          newValue: name,
          editedBy: requestorId,
        });
        updateData.name = name;
      }

      // Track unit change
      if (unit && unit !== invType.unit) {
        historyDocs.push({
          invtypeId,
          field: 'unit',
          oldValue: invType.unit,
          newValue: unit,
          editedBy: requestorId,
        });
        updateData.unit = unit;
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

  const fetchInvTypeHistory = async (req, res) => {
    try {
      const { invtypeId } = req.params;

      if (!invtypeId || !invtypeId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid inventory type id' });
      }

      const history = await invTypeHistory
        .find({ invtypeId })
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
    fetchSingleInventoryType,
    updateNameAndUnit,
    addMaterialType,
    addConsumableType,
    addToolType,
    fetchInvUnitsFromJson,
    fetchInventoryByType,
    fetchInvTypeHistory,
  };
}

module.exports = bmInventoryTypeController;
