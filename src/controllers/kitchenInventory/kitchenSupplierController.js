/* eslint-disable max-lines-per-function */ const mongoose = require('mongoose');
const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');

const kitchenSupplierController = function () {
  const createSupplier = async (req, res) => {
    try {
      const { name, contactName, email, phone, address, specialities, isActive } = req.body;

      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Invalid supplier name' });
      }

      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'Invalid isActive value' });
      }

      const normalizedName = name.trim();
      const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const existingSupplier = await Supplier.findOne({
        name: { $regex: `^${escapedName}$`, $options: 'i' },
      });

      if (existingSupplier) {
        return res.status(400).json({ message: 'Supplier already exists' });
      }

      const supplierData = {
        name: normalizedName,
      };

      if (contactName !== undefined) {
        supplierData.contactName = contactName;
      }

      if (email !== undefined) {
        supplierData.email = email;
      }

      if (phone !== undefined) {
        supplierData.phone = phone;
      }

      if (address !== undefined) {
        supplierData.address = address;
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
      res.status(400).json({ err: 'Unable to create supplier' });
    }
  };
  const getSuppliers = async (req, res) => {
    try {
      const results = await Supplier.find().lean();
      res.status(200).json(results);
    } catch (err) {
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
      res.status(500).json({ err: 'Internal server error' });
    }
  };
  const updateSupplier = async (req, res) => {
    const { supplierId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(supplierId))) {
      return res.status(400).json({ message: 'Invalid Supplier Id' });
    }
    try {
      const { name, contactName, email, phone, address, specialities, isActive } = req.body;
      const update = { updated: Date.now() };
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ message: 'Invalid supplier name' });
        }
        update.name = name.trim();
      }
      if (contactName !== undefined) {
        update.contactName = contactName;
      }
      if (email !== undefined) {
        update.email = email;
      }
      if (phone !== undefined) {
        update.phone = phone;
      }
      if (address !== undefined) {
        update.address = address;
      }
      if (specialities !== undefined) {
        update.specialities = specialities;
      }
      if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') {
          return res.status(400).json({ message: 'Invalid isActive value' });
        }

        update.isActive = isActive;
      }
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
      res.status(400).json({ err: 'Unable to update supplier' });
    }
  };
  const deleteSupplier = async (req, res) => {
    const { supplierId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(supplierId))) {
      return res.status(400).json({ message: 'Invalid Supplier Id' });
    }
    try {
      const removed = await Supplier.findByIdAndDelete(
        new mongoose.Types.ObjectId(String(supplierId)),
      );
      if (!removed) {
        return res.status(404).json({ message: 'Supplier Not Found' });
      }
      res.status(200).json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ err: 'Internal server error' });
    }
  };
  return { createSupplier, getSuppliers, getSupplierById, updateSupplier, deleteSupplier };
};
module.exports = kitchenSupplierController;
