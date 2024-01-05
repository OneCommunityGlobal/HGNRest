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

  return {
    fetchMaterialTypes,
  };
};

module.exports = bmInventoryTypeController;
