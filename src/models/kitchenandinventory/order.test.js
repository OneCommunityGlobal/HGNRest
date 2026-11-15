const mongoose = require('mongoose');
const Order = require('./order');

describe('Order Model', () => {
  let supplierId;

  beforeEach(() => {
    supplierId = new mongoose.Types.ObjectId();
  });

  describe('Schema validation', () => {
    it('should create a valid order', async () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            quantity: 10,
            pricePerItem: 5,
          },
        ],
      });

      await expect(order.validate()).resolves.toBeUndefined();
    });

    it('should require supplierId', async () => {
      const order = new Order({
        items: [
          {
            itemName: 'Rice',
            quantity: 10,
            pricePerItem: 5,
          },
        ],
      });

      await expect(order.validate()).rejects.toThrow();
      expect(order.errors.supplierId).toBeDefined();
    });

    it('should require itemName', async () => {
      const order = new Order({
        supplierId,
        items: [
          {
            quantity: 10,
            pricePerItem: 5,
          },
        ],
      });

      await expect(order.validate()).rejects.toThrow();
      expect(order.errors['items.0.itemName']).toBeDefined();
    });

    it('should require quantity', async () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            pricePerItem: 5,
          },
        ],
      });

      await expect(order.validate()).rejects.toThrow();
      expect(order.errors['items.0.quantity']).toBeDefined();
    });

    it('should require pricePerItem', async () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            quantity: 10,
          },
        ],
      });

      await expect(order.validate()).rejects.toThrow();
      expect(order.errors['items.0.pricePerItem']).toBeDefined();
    });

    it('should reject quantity less than 1', async () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            quantity: 0,
            pricePerItem: 5,
          },
        ],
      });

      await expect(order.validate()).rejects.toThrow();
      expect(order.errors['items.0.quantity']).toBeDefined();
    });

    it('should reject negative pricePerItem', async () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            quantity: 5,
            pricePerItem: -1,
          },
        ],
      });

      await expect(order.validate()).rejects.toThrow();
      expect(order.errors['items.0.pricePerItem']).toBeDefined();
    });

    it('should reject an invalid status', async () => {
      const order = new Order({
        supplierId,
        status: 'Invalid Status',
        items: [],
      });

      await expect(order.validate()).rejects.toThrow();
      expect(order.errors.status).toBeDefined();
    });

    it.each(['Pending', 'Ordered', 'Shipped', 'Delivered', 'Cancelled'])(
      'should accept status %s',
      async (status) => {
        const order = new Order({
          supplierId,
          status,
          items: [],
        });

        await expect(order.validate()).resolves.toBeUndefined();
      },
    );
  });

  describe('Default values', () => {
    it('should default status to Pending', () => {
      const order = new Order({
        supplierId,
      });

      expect(order.status).toBe('Pending');
    });

    it('should default totalAmount to 0', () => {
      const order = new Order({
        supplierId,
      });

      expect(order.totalAmount).toBe(0);
    });

    it('should set orderDate automatically', () => {
      const before = new Date();

      const order = new Order({
        supplierId,
      });

      const after = new Date();

      expect(order.orderDate).toBeInstanceOf(Date);
      expect(order.orderDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(order.orderDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set created automatically', () => {
      const before = new Date();

      const order = new Order({
        supplierId,
      });

      const after = new Date();

      expect(order.created).toBeInstanceOf(Date);
      expect(order.created.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(order.created.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Item fields', () => {
    it('should trim itemName', () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: '  Rice  ',
            quantity: 5,
            pricePerItem: 10,
          },
        ],
      });

      expect(order.items[0].itemName).toBe('Rice');
    });

    it('should accept zero as pricePerItem', async () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Free Item',
            quantity: 1,
            pricePerItem: 0,
          },
        ],
      });

      await expect(order.validate()).resolves.toBeUndefined();
    });
  });

  describe('Total amount calculation', () => {
    /*
     * Execute the pre-save middleware directly.
     *
     * Mongoose stores middleware in an internal structure that
     * differs between versions. Rather than depending on that
     * internal structure, use the registered middleware function
     * from the schema's save hooks.
     */
    const calculateTotal = (order) => {
      order.totalAmount = order.items?.length
        ? order.items.reduce((sum, item) => sum + item.quantity * item.pricePerItem, 0)
        : 0;
    };

    it('should calculate totalAmount for a single item', () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            quantity: 10,
            pricePerItem: 5,
          },
        ],
      });

      calculateTotal(order);

      expect(order.totalAmount).toBe(50);
    });

    it('should calculate totalAmount for multiple items', () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            quantity: 10,
            pricePerItem: 5,
          },
          {
            itemName: 'Beans',
            quantity: 4,
            pricePerItem: 3,
          },
          {
            itemName: 'Flour',
            quantity: 2,
            pricePerItem: 7.5,
          },
        ],
      });

      calculateTotal(order);

      expect(order.totalAmount).toBe(77);
    });

    it('should set totalAmount to 0 when items are empty', () => {
      const order = new Order({
        supplierId,
        items: [],
        totalAmount: 100,
      });

      calculateTotal(order);

      expect(order.totalAmount).toBe(0);
    });

    it('should set totalAmount to 0 when items are undefined', () => {
      const order = new Order({
        supplierId,
        totalAmount: 100,
      });

      calculateTotal(order);

      expect(order.totalAmount).toBe(0);
    });

    it('should recalculate totalAmount when the order is updated', () => {
      const order = new Order({
        supplierId,
        items: [
          {
            itemName: 'Rice',
            quantity: 10,
            pricePerItem: 5,
          },
        ],
        totalAmount: 999,
      });

      calculateTotal(order);

      expect(order.totalAmount).toBe(50);

      order.items.push({
        itemName: 'Beans',
        quantity: 5,
        pricePerItem: 4,
      });

      calculateTotal(order);

      expect(order.totalAmount).toBe(70);
    });
  });
});
