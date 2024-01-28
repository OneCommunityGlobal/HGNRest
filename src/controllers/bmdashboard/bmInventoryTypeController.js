const fs = require('fs');
const fsPromises = require('fs/promises');

const path = require('path');
const filename = 'BuildingUnits.json';
const currentFilePath = __filename;
const rootPath = path.resolve(path.dirname(currentFilePath), '../../../'); // Go up three levels to the root
const filepath = path.join(rootPath, filename);
const readFile = fs.readFile;
const writeFile = fs.writeFile;

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

  const fetchInvUnitsFromJson = async (req, res) => {
    try {
      console.log(__dirname,filepath)
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
      MatType
        .find({ name })
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
            MatType
            .create(newDoc)
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
                      const separator = (updatedContent !== '') ? ',\n' : '';
                      const updatedFileContent = `${updatedContent}${separator}${newItemString}\n]`;

                      writeFile(filepath, updatedFileContent, 'utf8', (error) => {
                        if (error) {
                          console.error('Error writing to file:', error);
                          return;
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
        .catch(error => res.status(500).send(error));
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
      const index = unitsArray.findIndex(unitObject => unitObject.unit === unit);
      if (index === -1) {
        res.status(400).json('Unit does not exist');
        return;
      }

      // otherwise, remove unit
      const filteredUnits = unitsArray.filter(unitObject => unitObject.unit !== unit);

      // save updated array into JSON file and rend it back
      await fsPromises.writeFile(filepath, JSON.stringify(filteredUnits, null, ' '));
      res.status(200).send(filteredUnits);
    } catch (err) {
      res.status(500).send(err);
      console.error(err);
    }
  };

  const updateSingleInvType = async (req, res) => {
    const { invtypeId } = req.params;
    res.status(200).json({ message: 'updated', invtypeId });
  }

  const deleteSingleInvType = async (req, res) => {
    const { invtypeId } = req.params;
    res.status(200).json({ message: 'deleted', invtypeId });
  }

  return {
    fetchMaterialTypes,
    addEquipmentType,
    fetchSingleInventoryType,
    updateNameAndUnit,
    addMaterialType,
    fetchInvUnitsFromJson,
    fetchInventoryByType,
    addInvUnit,
    deleteInvUnit,
    updateSingleInvType,
    deleteSingleInvType,
  };
}

module.exports = bmInventoryTypeController;
