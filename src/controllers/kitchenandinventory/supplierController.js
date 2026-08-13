const Supplier = require('../../models/kitchenandinventory/supplier');

const getSuppliers = async (req, res) => {
  try {
    const { search = '', activeOnly = 'false' } = req.query;

    const query = {};

    if (activeOnly === 'true') {
      query.isActive = true;
    }

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { contact: searchRegex },
      ];
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean();

    return res.status(200).json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return res.status(500).json({
      message: 'Failed to fetch suppliers',
    });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        message: 'Supplier not found',
      });
    }

    return res.status(200).json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);

    return res.status(500).json({
      message: 'Failed to fetch supplier',
    });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { name, contact, email, phone, specialities, website } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({
        message: 'Name, email, and phone are required',
      });
    }

    const existingSupplier = await Supplier.findOne({
      email: email.toLowerCase(),
    });

    if (existingSupplier) {
      return res.status(409).json({
        message: 'A supplier with this email already exists',
      });
    }

    const supplier = await Supplier.create({
      name,
      contact,
      email,
      phone,
      specialities,
      website,
    });

    return res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);

    return res.status(500).json({
      message: 'Failed to create supplier',
    });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { name, contact, email, phone, specialities, website, isActive } = req.body;

    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        message: 'Supplier not found',
      });
    }

    if (name !== undefined) supplier.name = name;
    if (contact !== undefined) supplier.contact = contact;
    if (email !== undefined) supplier.email = email;
    if (phone !== undefined) supplier.phone = phone;
    if (specialities !== undefined) supplier.specialities = specialities;
    if (website !== undefined) supplier.website = website;
    if (isActive !== undefined) supplier.isActive = isActive;

    supplier.updated = new Date();

    await supplier.save();

    return res.status(200).json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);

    return res.status(500).json({
      message: 'Failed to update supplier',
    });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        message: 'Supplier not found',
      });
    }

    // Soft delete instead of actually removing the supplier.
    supplier.isActive = false;
    supplier.updated = new Date();

    await supplier.save();

    return res.status(200).json({
      message: 'Supplier deactivated successfully',
      supplier,
    });
  } catch (error) {
    console.error('Error deactivating supplier:', error);

    return res.status(500).json({
      message: 'Failed to deactivate supplier',
    });
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
