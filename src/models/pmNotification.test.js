const mongoose = require('mongoose');

describe('pmNotification model', () => {
  let PMNotification;

  beforeEach(() => {
    delete mongoose.connection.models.PMNotification;
    jest.resetModules();
    // eslint-disable-next-line global-require
    PMNotification = require('./pmNotification');
  });

  it('exports a mongoose model with expected schema paths', () => {
    expect(PMNotification.modelName).toBe('PMNotification');
    expect(PMNotification.schema.path('message')).toBeDefined();
    expect(PMNotification.schema.path('educatorIds')).toBeDefined();
    expect(PMNotification.schema.path('createdBy')).toBeDefined();
    expect(PMNotification.schema.path('createdAt')).toBeDefined();
    expect(PMNotification.schema.path('updatedAt')).toBeDefined();
  });

  it('references Educator for educatorIds and UserProfile for createdBy', () => {
    expect(PMNotification.schema.path('educatorIds').caster.options.ref).toBe('Educator');
    expect(PMNotification.schema.path('createdBy').options.ref).toBe('UserProfile');
  });

  it('requires message and caps it at 1000 characters', () => {
    const messagePath = PMNotification.schema.path('message');
    expect(messagePath.isRequired).toBe(true);
    expect(messagePath.options.maxlength).toBe(1000);
  });

  it('fails validation when message is missing', () => {
    const doc = new PMNotification({});
    const err = doc.validateSync();

    expect(err.errors.message).toBeDefined();
  });

  it('fails validation when message exceeds 1000 characters', () => {
    const doc = new PMNotification({ message: 'a'.repeat(1001) });
    const err = doc.validateSync();

    expect(err.errors.message).toBeDefined();
  });

  it('passes validation when message is exactly 1000 characters', () => {
    const doc = new PMNotification({ message: 'a'.repeat(1000) });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
  });

  it('passes validation with a message and casts educatorIds/createdBy to ObjectIds', () => {
    const educatorId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const doc = new PMNotification({
      message: 'New assignment posted',
      educatorIds: [educatorId.toString()],
      createdBy: userId.toString(),
    });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    // Cast values are ObjectId-like instances from the freshly required mongoose
    // module (jest.resetModules() means it isn't the same class reference as the
    // outer `mongoose`), so compare by string form rather than `instanceof`.
    expect(typeof doc.educatorIds[0]).toBe('object');
    expect(doc.educatorIds[0].toString()).toBe(educatorId.toString());
    expect(typeof doc.createdBy).toBe('object');
    expect(doc.createdBy.toString()).toBe(userId.toString());
  });
});
