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
  const getPreservedStock = async (req, res) => {
    const oneyearFromNow = new Date();
    oneyearFromNow.setFullYear(oneyearFromNow.getFullYear() + 1);
    try {
      const items = await KIInventoryItem.find(
        { category: 'INGREDIENT', expiryDate: { $gte: oneyearFromNow } },
        { __v: 0 },
      )
        .lean()
        .sort({ presentQuantity: -1 });
      res.status(200).json({ message: 'Preserved stock items fetched successfully.', data: items });
    } catch (err) {
      res
        .status(400)
        .json({ message: 'Something went wrong while fetching preserved stock items.' });
    }
  };
  const updateOnUsage = async (req, res) => {
    const { itemId, usedQuantity } = req.body;
    if (usedQuantity <= 0) {
      return res.status(400).json({ message: 'Used quantity must be greater than zero.' });
    }
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
    if (addedQuantity <= 0) {
      return res.status(400).json({ message: 'Added quantity must be greater than zero.' });
    }
    if (newExpiry && new Date(newExpiry) < new Date()) {
      return res.status(400).json({ message: 'New expiry date must be a future date.' });
    }
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
  const updateNextHarvest = async (req, res) => {
    const { itemId, lastHarvestSuccess, nextHarvestDate, nextHarvestQuantity } = req.body;
    try {
      const item = await KIInventoryItem.findById(itemId);
      if (!item) {
        return res.status(404).json({ message: 'Item not found.' });
      }
      if (lastHarvestSuccess) {
        item.lastHarvestDate = item.nextHarvestDate;
      }
      item.nextHarvestDate = nextHarvestDate;
      item.nextHarvestQuantity = nextHarvestQuantity;
      item.updatedAt = new Date();
      await item.save();
      res.status(200).json({ message: 'Next harvest details updated successfully.', data: item });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };
  return {
    addItem,
    getItems,
    getItemsByCategory,
    getPreservedStock,
    updateOnUsage,
    updateStoredQuantity,
    updateNextHarvest,
  };
};
module.exports = KIInventoryController;
