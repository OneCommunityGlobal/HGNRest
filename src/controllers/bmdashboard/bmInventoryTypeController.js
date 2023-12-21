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
    const { name, desc } = req.body;
    console.log(name, desc);
    try {
      res.status(201).send({ message: 'Hello world!' });
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
