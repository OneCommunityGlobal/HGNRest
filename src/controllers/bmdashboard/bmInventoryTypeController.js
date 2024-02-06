const fs = require('fs');

const filepath = 'src/controllers/bmdashboard/BuildingUnits.json';

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


  async function fetchConsumableTypes(req, res) {
    try {
      ConsType
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
      fs.readFile(filepath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          return;
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
                    fs.readFile(filepath, 'utf8', (err, data) => {
                      if (err) {
                        console.error('Error reading file:', err);
                        return;
                      }
                      // Remove the last array bracket and comma
                      const updatedContent = data.trim().replace(/\s*]$/, '');

                      // Add a comma and newline if the file is not empty
                      const separator = (updatedContent !== '') ? ',\n' : '';
                      const updatedFileContent = `${updatedContent}${separator}${newItemString}\n]`;

                      fs.writeFile(filepath, updatedFileContent, 'utf8', (error) => {
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


    async function addConsumableType(req, res) {
      const {
        name,
        description,
        unit,
        size,
        requestor: { requestorId },
      } = req.body;

      try {
        ConsType
        .find({ name })
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
              ConsType
              .create(newDoc)
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
          .catch(error => {
            res.status(500).send(error)});
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
  return {
    fetchMaterialTypes,
    fetchConsumableTypes,
    addEquipmentType,
    fetchSingleInventoryType,
    updateNameAndUnit,
    addMaterialType,
    addConsumableType,
    fetchInvUnitsFromJson,
    fetchInventoryByType,
  };
}

module.exports = bmInventoryTypeController;
