const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const filename = 'BuildingUnits.json';
const currentFilePath = __filename;
const rootPath = path.resolve(path.dirname(currentFilePath), '../../../'); // Go up three levels to the root
const filepath = path.join(rootPath, filename);
const { readFile } = fs;
const { writeFile } = fs;

function bmInventoryTypeController(InvType, MatType, ConsType, ReusType, ToolType, EquipType) {
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
      // console.log(__dirname,filepath)
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
    const { invtypeId } = req.params;
    const { name, unit } = req.body;

    try {
      const updatedInvType = await InvType.findByIdAndUpdate(
        invtypeId,
        { name, unit },
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

  const addInvUnit = async (req, res) => {
    // NOTE: category is default to be Material as no other item types need units
    const { unit, category = 'Material' } = req.body;
    if (typeof unit !== 'string' || unit.length === 0) {
      res.status(400).json('Invalid unit');
      return;
    }

    try {
      // read JSON file and parse it into an array
      const unitsJSON = await fsPromises.readFile(filepath, { encoding: 'utf8' });
      const unitsArray = JSON.parse(unitsJSON);

      // append new unit into array
      unitsArray.push({ unit, category });

      // save updated array into JSON file and rend it back
      await fsPromises.writeFile(filepath, JSON.stringify(unitsArray, null, ' '));

      res.status(201).send(unitsArray);
    } catch (err) {
      res.status(500).send(err);
      console.error(err);
    }
  };

  const deleteInvUnit = async (req, res) => {
    const { unit } = req.body;
    if (typeof unit !== 'string' || unit.length === 0) {
      res.status(400).json('Invalid unit');
      return;
    }

    try {
      // read JSON file and parse it into an array
      const unitsJSON = await fsPromises.readFile(filepath, { encoding: 'utf8' });
      const unitsArray = JSON.parse(unitsJSON);

      // if unit does not exist, send err response
      const index = unitsArray.findIndex((unitObject) => unitObject.unit === unit);
      if (index === -1) {
        res.status(400).json('Unit does not exist');
        return;
      }

      // otherwise, remove unit
      const filteredUnits = unitsArray.filter((unitObject) => unitObject.unit !== unit);

      // save updated array into JSON file and rend it back
      await fsPromises.writeFile(filepath, JSON.stringify(filteredUnits, null, ' '));
      res.status(200).send(filteredUnits);
    } catch (err) {
      res.status(500).send(err);
      console.error(err);
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
    addInvUnit,
    deleteInvUnit,
    updateSingleInvType,
    deleteSingleInvType,
  };
}

module.exports = bmInventoryTypeController;
