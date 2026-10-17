const mongoose = require('mongoose');
const Supplier = require('./supplier');

describe('Supplier Model', () => {
  describe('Schema validation', () => {
    it('should create a valid supplier', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        contact: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        specialities: ['Food', 'Equipment'],
        website: 'https://example.com',
      });

      await expect(supplier.validate()).resolves.toBeUndefined();
    });

    it('should require name', async () => {
      const supplier = new Supplier({
        email: 'john@example.com',
        phone: '1234567890',
      });

      await expect(supplier.validate()).rejects.toThrow();
      expect(supplier.errors.name).toBeDefined();
    });

    it('should require email', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        phone: '1234567890',
      });

      await expect(supplier.validate()).rejects.toThrow();
      expect(supplier.errors.email).toBeDefined();
    });

    it('should require phone', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
      });

      await expect(supplier.validate()).rejects.toThrow();
      expect(supplier.errors.phone).toBeDefined();
    });

    it('should allow contact to be omitted', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
      });

      await expect(supplier.validate()).resolves.toBeUndefined();
    });

    it('should allow website to be omitted', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
      });

      await expect(supplier.validate()).resolves.toBeUndefined();
    });
  });

  describe('Email validation', () => {
    it.each([
      'test@example.com',
      'john.doe@example.com',
      'supplier@company.org',
      'user123@test.co',
    ])('should accept valid email: %s', async (email) => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email,
        phone: '1234567890',
      });

      await expect(supplier.validate()).resolves.toBeUndefined();
    });

    it.each(['invalid', '@example.com', 'test@', 'test@example', 'test@example.'])(
      'should reject invalid email: %s',
      async (email) => {
        const supplier = new Supplier({
          name: 'ABC Supplies',
          email,
          phone: '1234567890',
        });

        await expect(supplier.validate()).rejects.toThrow();
        expect(supplier.errors.email).toBeDefined();
      },
    );

    it('should reject an email without @', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john.example.com',
        phone: '1234567890',
      });

      await expect(supplier.validate()).rejects.toThrow();

      expect(supplier.errors.email.message).toBe('Provide valid email address');
    });

    it('should reject an email without a domain', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@',
        phone: '1234567890',
      });

      await expect(supplier.validate()).rejects.toThrow();

      expect(supplier.errors.email.message).toBe('Provide valid email address');
    });
  });

  describe('Default values', () => {
    it('should default isActive to true', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
      });

      expect(supplier.isActive).toBe(true);
    });

    it('should set created automatically', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
      });

      expect(supplier.created).toBeInstanceOf(Date);
    });

    it('should set updated automatically', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
      });

      expect(supplier.updated).toBeInstanceOf(Date);
    });
  });

  describe('String trimming', () => {
    it('should trim the supplier name', () => {
      const supplier = new Supplier({
        name: '  ABC Supplies  ',
        email: 'john@example.com',
        phone: '1234567890',
      });

      expect(supplier.name).toBe('ABC Supplies');
    });

    it('should trim the contact', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        contact: '  John Doe  ',
        email: 'john@example.com',
        phone: '1234567890',
      });

      expect(supplier.contact).toBe('John Doe');
    });

    it('should trim the email', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: '  john@example.com  ',
        phone: '1234567890',
      });

      expect(supplier.email).toBe('john@example.com');
    });

    it('should trim the phone', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '  1234567890  ',
      });

      expect(supplier.phone).toBe('1234567890');
    });

    it('should trim the website', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
        website: '  https://example.com  ',
      });

      expect(supplier.website).toBe('https://example.com');
    });

    it('should trim speciality values', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
        specialities: ['  Food  ', '  Equipment  ', '  Cleaning Supplies  '],
      });

      expect([...supplier.specialities]).toEqual(['Food', 'Equipment', 'Cleaning Supplies']);
    });
  });

  describe('Email normalization', () => {
    it('should convert email to lowercase', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'JOHN@EXAMPLE.COM',
        phone: '1234567890',
      });

      expect(supplier.email).toBe('john@example.com');
    });

    it('should trim and lowercase the email together', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: '  JOHN@EXAMPLE.COM  ',
        phone: '1234567890',
      });

      expect(supplier.email).toBe('john@example.com');
    });
  });

  describe('Specialities', () => {
    it('should allow multiple specialities', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
        specialities: ['Food', 'Equipment', 'Cleaning'],
      });

      await expect(supplier.validate()).resolves.toBeUndefined();

      expect(supplier.specialities).toHaveLength(3);
    });

    it('should allow an empty speciality list', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
        specialities: [],
      });

      await expect(supplier.validate()).resolves.toBeUndefined();

      expect([...supplier.specialities]).toEqual([]);
    });
  });

  describe('isActive', () => {
    it('should allow isActive to be false', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
        isActive: false,
      });

      await expect(supplier.validate()).resolves.toBeUndefined();

      expect(supplier.isActive).toBe(false);
    });

    it('should allow isActive to be true', async () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
        isActive: true,
      });

      await expect(supplier.validate()).resolves.toBeUndefined();

      expect(supplier.isActive).toBe(true);
    });
  });

  describe('Pre-save timestamp middleware', () => {
    it('should have a pre-save timestamp middleware registered', () => {
      const { hooks } = Supplier.schema.s;

      expect(hooks).toBeDefined();
    });

    it('should update the updated timestamp when middleware runs', () => {
      const supplier = new Supplier({
        name: 'ABC Supplies',
        email: 'john@example.com',
        phone: '1234567890',
      });

      const oldDate = new Date('2020-01-01T00:00:00.000Z');

      supplier.updated = oldDate;

      const hook = Supplier.schema.s.hooks._pres
        .get('save')
        .find(({ fn }) => fn.name === 'updateTimestamp');

      expect(hook).toBeDefined();

      hook.fn.call(supplier, () => {});

      expect(supplier.updated).toBeInstanceOf(Date);
      expect(supplier.updated.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });
});
