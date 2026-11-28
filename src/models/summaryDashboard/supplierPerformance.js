const mongoose = require('mongoose');

const { Schema } = mongoose;

const SupplierPerformanceSchema = new Schema({
  supplierId: { type: String, trim: true },
  slaTarget: { type: Number, min: 0, max: 100 },
  supplierName: { type: String, required: true },
  onTimeDeliveryPercentage: { type: Number, required: true, min: 0, max: 100 },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'project', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
});

module.exports = mongoose.model(
  'SupplierPerformance',
  SupplierPerformanceSchema,
  'supplier_performances',
);
