const mongoose = require('mongoose');

describe('pmEducators model', () => {
  let Educator;

  beforeEach(() => {
    delete mongoose.connection.models.Educator;
    jest.resetModules();
    // eslint-disable-next-line global-require
    Educator = require('./pmEducators');
  });

  it('exports a mongoose model with expected schema paths', () => {
    expect(Educator.modelName).toBe('Educator');
    expect(Educator.schema.path('externalId')).toBeDefined();
    expect(Educator.schema.path('name')).toBeDefined();
    expect(Educator.schema.path('subject')).toBeDefined();
    expect(Educator.schema.path('createdAt')).toBeDefined();
    expect(Educator.schema.path('updatedAt')).toBeDefined();
  });

  it('requires name and subject but not externalId', () => {
    expect(Educator.schema.path('name').isRequired).toBe(true);
    expect(Educator.schema.path('subject').isRequired).toBe(true);
    expect(Educator.schema.path('externalId').isRequired).toBeFalsy();
  });

  it('defines externalId as a sparse unique index', () => {
    const externalIdPath = Educator.schema.path('externalId');
    expect(externalIdPath.options.unique).toBe(true);
    expect(externalIdPath.options.sparse).toBe(true);
  });

  it('fails validation when name and subject are missing', () => {
    const doc = new Educator({});
    const err = doc.validateSync();

    expect(err.errors.name).toBeDefined();
    expect(err.errors.subject).toBeDefined();
  });

  it('passes validation when name and subject are provided', () => {
    const doc = new Educator({ name: 'Ada Lovelace', subject: 'Math' });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
  });

  it('passes validation without an externalId', () => {
    const doc = new Educator({ name: 'Ada Lovelace', subject: 'Math' });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.externalId).toBeUndefined();
  });
});
