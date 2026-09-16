const mongoose = require('mongoose');

const { Schema } = mongoose;

const Order = new Schema({
  supplierId: {
    type: Schema.Types.ObjectId,
    ref: 'supplier',
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Ordered', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  expectedDeliveryDate: {
    type: Date,
  },
  actualDeliveryDate: {
    type: Date,
  },
  items: [
    {
      itemName: {
        type: String,
        required: true,
        trim: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      pricePerItem: {
        type: Number,
        required: true,
        min: 0,
      },
    },
  ],
  totalAmount: {
    type: Number,
    default: 0,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

Order.pre('save', function (next) {
  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((sum, item) => sum + item.quantity * item.pricePerItem, 0);
  }
  next();
});

module.exports = mongoose.model('order', Order, 'orders');
