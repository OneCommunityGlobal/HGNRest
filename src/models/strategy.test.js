const mongoose = require('mongoose');

describe('strategy model - schema', () => {
  let Strategy;

  beforeEach(() => {
    delete mongoose.connection.models.Strategy;
    jest.resetModules();
    // eslint-disable-next-line global-require
    Strategy = require('./strategy');
  });

  it('exports a mongoose model with the expected schema paths', () => {
    expect(Strategy.modelName).toBe('Strategy');
    expect(Strategy.schema.path('name')).toBeDefined();
    expect(Strategy.schema.path('type')).toBeDefined();
    expect(Strategy.schema.path('description')).toBeDefined();
    expect(Strategy.schema.path('color')).toBeDefined();
    expect(Strategy.schema.path('isActive')).toBeDefined();
    expect(Strategy.schema.path('createdAt')).toBeDefined();
    expect(Strategy.schema.path('updatedAt')).toBeDefined();
  });

  it('requires and trims name, and marks it unique', () => {
    const namePath = Strategy.schema.path('name');
    expect(namePath.isRequired).toBe(true);
    expect(namePath.options.trim).toBe(true);
    expect(namePath.options.unique).toBe(true);
  });

  it('requires type and restricts it to the expected enum values', () => {
    const typePath = Strategy.schema.path('type');
    expect(typePath.isRequired).toBe(true);
    expect(typePath.enumValues).toEqual(['teaching_strategy', 'life_strategy', 'activity_group']);
  });

  it('trims description', () => {
    expect(Strategy.schema.path('description').options.trim).toBe(true);
  });

  it('defaults color to #6c757d', () => {
    expect(Strategy.schema.path('color').options.default).toBe('#6c757d');
  });

  it('defaults isActive to true', () => {
    expect(Strategy.schema.path('isActive').options.default).toBe(true);
  });

  it('declares indexes on type, name, and isActive', () => {
    const indexes = Strategy.schema.indexes().map(([fields]) => fields);
    expect(indexes).toEqual(expect.arrayContaining([{ type: 1 }, { name: 1 }, { isActive: 1 }]));
  });

  it('fails validation when name is missing', () => {
    const doc = new Strategy({ type: 'teaching_strategy' });
    const err = doc.validateSync();

    expect(err.errors.name).toBeDefined();
  });

  it('fails validation when type is missing', () => {
    const doc = new Strategy({ name: 'Growth Mindset' });
    const err = doc.validateSync();

    expect(err.errors.type).toBeDefined();
  });

  it('fails validation when type is not one of the allowed enum values', () => {
    const doc = new Strategy({ name: 'Growth Mindset', type: 'not_a_real_type' });
    const err = doc.validateSync();

    expect(err.errors.type).toBeDefined();
  });

  it('passes validation and applies defaults for a minimal valid document', () => {
    const doc = new Strategy({ name: 'Growth Mindset', type: 'life_strategy' });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.color).toBe('#6c757d');
    expect(doc.isActive).toBe(true);
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('trims whitespace from name and description on assignment', () => {
    const doc = new Strategy({
      name: '  Growth Mindset  ',
      type: 'activity_group',
      description: '  Encourages persistence  ',
    });

    expect(doc.name).toBe('Growth Mindset');
    expect(doc.description).toBe('Encourages persistence');
  });

  it('accepts explicit overrides for color and isActive', () => {
    const doc = new Strategy({
      name: 'Custom Strategy',
      type: 'teaching_strategy',
      color: '#ff0000',
      isActive: false,
    });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.color).toBe('#ff0000');
    expect(doc.isActive).toBe(false);
  });
});
