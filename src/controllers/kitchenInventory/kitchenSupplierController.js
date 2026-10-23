/* eslint-disable max-lines-per-function */ const mongoose = require('mongoose');
const logger = require('../../startup/logger');
const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');
const getValidationErrorMessage = require('./validationErrorMessage');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

const kitchenSupplierController = function () {
  const createSupplier = async (req, res) => {
    try {
      const { name, contact, email, phone, website, specialities, isActive } = req.body;

      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Invalid supplier name' });
      }

      if (!isNonEmptyString(email)) {
        return res.status(400).json({ message: 'Supplier email is required' });
      }

      if (!isNonEmptyString(phone)) {
        return res.status(400).json({ message: 'Supplier phone is required' });
      }

      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'Invalid isActive value' });
      }

      const normalizedName = name.trim();
      const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

      const existingSupplier = await Supplier.findOne({
        name: { $regex: `^${escapedName}$`, $options: 'i' },
      });

      if (existingSupplier) {
        return res.status(400).json({ message: 'Supplier already exists' });
      }

      const supplierData = {
        name: normalizedName,
        email,
        phone,
      };

      if (contact !== undefined) {
        supplierData.contact = contact;
      }

      if (website !== undefined) {
        supplierData.website = website;
      }

      if (specialities !== undefined) {
        supplierData.specialities = specialities;
      }

      if (isActive !== undefined) {
        supplierData.isActive = isActive;
      }

      const supplier = new Supplier(supplierData);
      const result = await supplier.save();

      res.status(201).json(result);
    } catch (err) {
      const validationMessage = getValidationErrorMessage(err);
      if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
      }
      logger.logException(err);
      res.status(400).json({ err: 'Unable to create supplier' });
    }
  };
  const getSuppliers = async (req, res) => {
    try {
      const results = await Supplier.find().lean();
      res.status(200).json(results);
    } catch (err) {
      logger.logException(err);
      res.status(500).json({ err: 'Internal server error' });
    }
  };
  const getSupplierById = async (req, res) => {
    const { supplierId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(supplierId))) {
      return res.status(400).json({ message: 'Invalid Supplier' });
    }
    try {
      const validSupplierId = new mongoose.Types.ObjectId(String(supplierId));
      const supplier = await Supplier.findById(validSupplierId).lean();
      if (!supplier) {
        return res.status(404).json({ message: 'Supplier Not found' });
      }
      const agg = await Order.aggregate([
        {
          $match: {
            supplierId: validSupplierId,
            status: 'Delivered',
            actualDeliveryDate: { $exists: true },
          },
        },
        {
          $project: {
            diffDays: {
              $divide: [{ $subtract: ['$actualDeliveryDate', '$orderDate'] }, 1000 * 60 * 60 * 24],
            },
          },
        },
        { $group: { _id: null, totalOrders: { $sum: 1 }, avgDeliveryDays: { $avg: '$diffDays' } } },
      ]);
      const totals = agg[0] || { totalOrders: 0, avgDeliveryDays: 0 };
      const response = {
        ...supplier,
        attributes: supplier.specialities || [],
        totalOrders: totals.totalOrders || 0,
        avgDeliveryDays:
          totals.avgDeliveryDays !== undefined ? Number(totals.avgDeliveryDays.toFixed(2)) : 0,
      };
      res.status(200).json(response);
    } catch (err) {
      logger.logException(err);
      res.status(500).json({ err: 'Internal server error' });
    }
  };
  const updateSupplier = async (req, res) => {
    const { supplierId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(supplierId))) {
      return res.status(400).json({ message: 'Invalid Supplier Id' });
    }
    try {
      const { name, contact, email, phone, website, specialities, isActive } = req.body;
      const update = { updated: Date.now() };
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ message: 'Invalid supplier name' });
        }
        const normalizedName = name.trim();
        const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const existingSupplier = await Supplier.findOne({
          _id: { $ne: new mongoose.Types.ObjectId(String(supplierId)) },
          name: { $regex: `^${escapedName}$`, $options: 'i' },
        });
        if (existingSupplier) {
          return res.status(400).json({ message: 'Supplier already exists' });
        }
        update.name = normalizedName;
      }
      if (email !== undefined && !isNonEmptyString(email)) {
        return res.status(400).json({ message: 'Supplier email is required' });
      }
      if (phone !== undefined && !isNonEmptyString(phone)) {
        return res.status(400).json({ message: 'Supplier phone is required' });
      }
      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'Invalid isActive value' });
      }
      Object.entries({ contact, email, phone, website, specialities, isActive }).forEach(
        ([field, value]) => {
          if (value !== undefined) {
            update[field] = value;
          }
        },
      );
      const updated = await Supplier.findByIdAndUpdate(
        new mongoose.Types.ObjectId(String(supplierId)),
        update,
        { new: true, runValidators: true },
      );
      if (!updated) {
        return res.status(404).json({ message: 'Supplier Not Found' });
      }
      res.status(200).json(updated);
    } catch (err) {
      const validationMessage = getValidationErrorMessage(err);
      if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
      }
      logger.logException(err);
      res.status(400).json({ err: 'Unable to update supplier' });
    }
  };
  const deleteSupplier = async (req, res) => {
    const { supplierId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(supplierId))) {
      return res.status(400).json({ message: 'Invalid Supplier Id' });
    }
    try {
      // Soft delete: orders keep referencing the supplier, so its history stays intact.
      const deactivated = await Supplier.findByIdAndUpdate(
        new mongoose.Types.ObjectId(String(supplierId)),
        { isActive: false, updated: Date.now() },
        { new: true },
      );
      if (!deactivated) {
        return res.status(404).json({ message: 'Supplier Not Found' });
      }
      res.status(200).json({ message: 'Supplier deactivated', supplier: deactivated });
    } catch (err) {
      logger.logException(err);
      res.status(500).json({ err: 'Internal server error' });
    }
  };
  return { createSupplier, getSuppliers, getSupplierById, updateSupplier, deleteSupplier };
};
module.exports = kitchenSupplierController;
