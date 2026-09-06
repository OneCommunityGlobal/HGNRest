const Supplier = require('../../models/kitchenandinventory/supplier');

const SUPPLIER_NOT_FOUND_MESSAGE = 'Supplier not found';

const sendServerError = (res, message, error, logMessage) => {
  console.error(logMessage, error);

  return res.status(500).json({
    message,
  });
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const getSuppliers = async (req, res) => {
  try {
    const { search = '', activeOnly = 'false' } = req.query;

    const query = {};

    if (activeOnly === 'true') {
      query.isActive = true;
    }

    const trimmedSearch = search.trim();

    if (trimmedSearch) {
      const searchRegex = new RegExp(escapeRegex(trimmedSearch), 'i');

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
    return sendServerError(res, 'Failed to fetch suppliers', error, 'Error fetching suppliers:');
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        message: SUPPLIER_NOT_FOUND_MESSAGE,
      });
    }

    return res.status(200).json(supplier);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch supplier', error, 'Error fetching supplier:');
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

    const normalizedEmail = email.toLowerCase();

    const existingSupplier = await Supplier.findOne({
      email: normalizedEmail,
    });

    if (existingSupplier) {
      return res.status(409).json({
        message: 'A supplier with this email already exists',
      });
    }

    const supplier = await Supplier.create({
      name,
      contact,
      email: normalizedEmail,
      phone,
      specialities,
      website,
    });

    return res.status(201).json(supplier);
  } catch (error) {
    return sendServerError(res, 'Failed to create supplier', error, 'Error creating supplier:');
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { name, contact, email, phone, specialities, website, isActive } = req.body;

    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        message: SUPPLIER_NOT_FOUND_MESSAGE,
      });
    }

    const updates = {
      name,
      contact,
      email,
      phone,
      specialities,
      website,
      isActive,
    };

    Object.entries(updates).forEach(([field, value]) => {
      if (value !== undefined) {
        supplier[field] = field === 'email' ? value.toLowerCase() : value;
      }
    });

    supplier.updated = new Date();

    await supplier.save();

    return res.status(200).json(supplier);
  } catch (error) {
    return sendServerError(res, 'Failed to update supplier', error, 'Error updating supplier:');
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        message: SUPPLIER_NOT_FOUND_MESSAGE,
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
    return sendServerError(
      res,
      'Failed to deactivate supplier',
      error,
      'Error deactivating supplier:',
    );
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
