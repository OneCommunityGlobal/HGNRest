/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const Supplier = require('../../models/kitchenInventory/supplier');
const Order = require('../../models/kitchenInventory/order');

const kitchenSupplierController = function () {
  const createSupplier = async (req, res) => {
    try {
      const existingSupplier = await Supplier.findOne({
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
      });
      if (existingSupplier) return res.status(400).json('Supplier already exists');

      const supplier = new Supplier(req.body);
      const result = await supplier.save();
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json(err.message);
    }
  };

  const getSuppliers = async (req, res) => {
    try {
      const results = await Supplier.find().lean();
      res.status(200).json(results);
    } catch (err) {
      res.status(500).json(err.message);
    }
  };

  const getSupplierById = async (req, res) => {
    const { supplierId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json('Invalid Supplier');
    }

    try {
      const supplier = await Supplier.findById(supplierId).lean();
      if (!supplier) {
        return res.status(404).json('Supplier Not found');
      }

      const agg = await Order.aggregate([
        {
          $match: {
            supplierId: new mongoose.Types.ObjectId(supplierId),
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
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            avgDeliveryDays: { $avg: '$diffDays' },
          },
        },
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
      res.status(500).json(err.message);
    }
  };

  const updateSupplier = async (req, res) => {
    const { supplierId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json('Invalid Supplier Id');
    }
    try {
      req.body.updated = Date.now();
      const updated = await Supplier.findByIdAndUpdate(supplierId, req.body, { new: true });
      if (!updated) {
        return res.status(404).json('Supplier Not Found');
      }
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json(err);
    }
  };

  const deleteSupplier = async (req, res) => {
    const { supplierId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json('Invalid Supplier Id');
    }

    try {
      const removed = await Supplier.findByIdAndDelete(supplierId);
      if (!removed) {
        return res.status(404).json('Supplier Not Found');
      }
      res.status(200).json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json(err);
    }
  };

  return {
    createSupplier,
    getSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier,
  };
};

module.exports = kitchenSupplierController;
