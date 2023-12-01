const bmInventoryTypeController = function (InvType) {
  const fetchMaterialTypes = async (req, res) => {
    try {
      const result = await InvType.find().exec();
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send(error);
    }
  };
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

  return { fetchMaterialTypes, fetchSingleInventoryType, updateNameAndUnit };
};

module.exports = bmInventoryTypeController;
