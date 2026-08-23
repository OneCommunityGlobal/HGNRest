const mongoose = require('mongoose');

describe('bmdashboard studentAtom model', () => {
  beforeEach(() => {
    delete mongoose.connection.models.StudentAtom;
    jest.resetModules();
  });

  it('exports a mongoose model with the expected schema paths', () => {
    const StudentAtom = require('./studentAtom');

    expect(StudentAtom.modelName).toBe('StudentAtom');
    expect(StudentAtom.schema.path('studentId')).toBeDefined();
    expect(StudentAtom.schema.path('atomId')).toBeDefined();
    expect(StudentAtom.schema.path('status')).toBeDefined();
    expect(StudentAtom.schema.path('notes')).toBeDefined();
    expect(StudentAtom.schema.path('firstStartedAt')).toBeDefined();
    expect(StudentAtom.schema.path('completedAt')).toBeDefined();
    expect(StudentAtom.schema.path('createdAt')).toBeDefined();
    expect(StudentAtom.schema.path('updatedAt')).toBeDefined();
  });
});
