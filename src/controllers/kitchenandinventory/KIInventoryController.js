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
  const getItems = async (req, res) => {
    try {
      const items = await KIInventoryItem.find(null, { __v: 0 }).lean().sort({ createdAt: -1 });
      res.status(200).json({ message: 'All Items fetched successfully.', data: items });
    } catch (err) {
      res.status(400).json({ message: 'Something went wrong while fetching items.' });
    }
  };
  const getItemsByCategory = async (req, res) => {
    const { category } = req.params;
    try {
      const items = await KIInventoryItem.find({ category }, { __v: 0 })
        .lean()
        .sort({ createdAt: -1 });
      res.status(200).json({ message: 'Items fetched successfully.', data: items });
    } catch (err) {
      res.status(400).json({ message: 'Something went wrong while fetching items.' });
    }
  };
  const updateOnUsage = async (req, res) => {
    const { itemId, usedQuantity } = req.body; // Need to implement validation for usedQuantity
    try {
      const item = await KIInventoryItem.findById(itemId);
      if (!item) {
        return res.status(404).json({ message: 'Item not found.' });
      }
      if (item.expiryDate < new Date()) {
        return res.status(400).json({ message: `This item was expired on ${item.expiryDate}` });
      }
      let present = item.presentQuantity;
      present -= usedQuantity;
      if (present < 0) {
        present = 0;
      }
      item.presentQuantity = present;
      item.updatedAt = new Date();
      await item.save();
      res.status(200).json({ message: 'Item usage updated successfully.', data: item });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };
  const updateStoredQuantity = async (req, res) => {
    const { itemId, addedQuantity, newExpiry } = req.body;
    try {
      const item = await KIInventoryItem.findById(itemId);
      if (!item) {
        return res.status(404).json({ message: 'Item not found.' });
      }
      if (item.presentQuantity === 0 || item.expiryDate < new Date()) {
        item.storedQuantity = addedQuantity;
        item.presentQuantity = 0;
      } else {
        item.storedQuantity += addedQuantity;
      }
      item.presentQuantity += addedQuantity;
      if (newExpiry) {
        item.expiryDate = newExpiry;
      }
      item.updatedAt = new Date();
      await item.save();
      res.status(200).json({ message: 'Stored quantity updated successfully.', data: item });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };
  return { addItem, getItems, getItemsByCategory, updateOnUsage, updateStoredQuantity };
};
module.exports = KIInventoryController;
