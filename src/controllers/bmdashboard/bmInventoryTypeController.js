function bmInventoryTypeController(InvType) {
  async function fetchMaterialTypes(req, res) {
    try {
      InvType
        .find()
        .exec()
        .then(result => res.status(200).send(result))
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  }

  async function addEquipmentType(req, res) {
    const { name, desc: description } = req.body;
    const newDoc = {
      category: 'Equipment',
      name,
      description,
      unit: 'irrelevant',
      imageUrl: 'test string',
    };
    try {
      InvType
        .create(newDoc)
        .then(() => res.status(201).send())
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
