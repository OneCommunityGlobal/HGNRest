const bmInventoryTypeController = function (InvType) {
  const fetchMaterialTypes = async (req, res) => {
    try {
      InvType
        .find()
        .exec()
        .then(result => res.status(200).send(result))
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const addBuildingInventoryType = async function _matTypeList(req, res) {
    try {
      const inventoryTypeObject = new InvType();
      inventoryTypeObject.category = 'Material';
      inventoryTypeObject.name = req.body.name;
      inventoryTypeObject.description = req.body.description;
      inventoryTypeObject.unit =  req.body.unit || req.body.customUnit;
      inventoryTypeObject.save()
      .then(results => res.status(201).send(results))
      .catch(errors => res.status(500).send(errors));
    } catch (err) {
      res.json(err);
    }
  };
  return { fetchMaterialTypes , addBuildingInventoryType };
};

module.exports = bmInventoryTypeController;
