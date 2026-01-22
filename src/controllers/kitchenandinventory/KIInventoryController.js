const KIInventoryItem = require('../../models/kitchenandinventory/KIInventoryItems');

const KIInventoryController = () => {
  const addItem = async (req, res) => {
    const {
      name,
      storedQuantity,
      unit,
      type,
      monthlyUsage,
      category,
      expiryDate,
      location,
      onsite,
      reorderAt,
      lastHarvestDate,
      nextHarvestDate,
      nextHarvestQuantity,
    } = req.body;

    const newItem = new KIInventoryItem({
      name,
      storedQuantity,
      presentQuantity: storedQuantity,
      unit,
      type,
      monthlyUsage,
      category,
      expiryDate,
      location,
      onsite,
      reorderAt,
      lastHarvestDate,
      nextHarvestDate,
      nextHarvestQuantity,
    });

    try {
      const savedItem = await newItem.save();
      res.status(201).json({
        message: 'Inventory item added successfully',
        data: savedItem,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  return { addItem };
};
module.exports = KIInventoryController;
