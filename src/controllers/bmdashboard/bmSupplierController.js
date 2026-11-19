const BuildingSupplier = require('../../models/bmdashboard/buildingSupplier');

const HTTP_STATUS_CONFLICT = 409;

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await BuildingSupplier.find().sort({ name: 1 });
    return res.status(200).json(suppliers);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch suppliers' });
  }
};

const createSupplier = async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    const existingSupplier = await BuildingSupplier.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });

    if (existingSupplier) {
      return res.status(HTTP_STATUS_CONFLICT).json({ message: 'Supplier already exists' });
    }

    const supplier = await BuildingSupplier.create({ name });
    return res.status(201).json(supplier);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create supplier' });
  }
};

module.exports = {
  getSuppliers,
  createSupplier,
};
