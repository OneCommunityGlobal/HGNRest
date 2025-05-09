const mongoose = require('mongoose');
const { Schema } = mongoose;

const SupplierPerformanceSchema = new Schema({
  supplierName: { type: String, required: true },
  onTimeDeliveryPercentage: { type: Number, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'project', required: true },
  date: { type: Date, required: true },
});

module.exports = mongoose.model('SupplierPerformance', SupplierPerformanceSchema, 'supplier_performances');
