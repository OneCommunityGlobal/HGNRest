const mongoose = require('mongoose');

describe('pmStudents model', () => {
  let Student;

  beforeEach(() => {
    delete mongoose.connection.models.Student;
    jest.resetModules();
    // eslint-disable-next-line global-require
    Student = require('./pmStudents');
  });

  it('exports a mongoose model with expected schema paths', () => {
    expect(Student.modelName).toBe('Student');
    expect(Student.schema.path('name')).toBeDefined();
    expect(Student.schema.path('grade')).toBeDefined();
    expect(Student.schema.path('progress')).toBeDefined();
    expect(Student.schema.path('educator')).toBeDefined();
    expect(Student.schema.path('createdAt')).toBeDefined();
    expect(Student.schema.path('updatedAt')).toBeDefined();
  });

  it('requires name, grade, and educator', () => {
    expect(Student.schema.path('name').isRequired).toBe(true);
    expect(Student.schema.path('grade').isRequired).toBe(true);
    expect(Student.schema.path('educator').isRequired).toBe(true);
  });

  it('references Educator for the educator field', () => {
    expect(Student.schema.path('educator').options.ref).toBe('Educator');
  });

  it('defaults progress to 0', () => {
    expect(Student.schema.path('progress').defaultValue).toBe(0);

    const doc = new Student({
      name: 'Alex',
      grade: '5th',
      educator: new mongoose.Types.ObjectId(),
    });
    expect(doc.progress).toBe(0);
  });

  it('fails validation when name, grade, and educator are missing', () => {
    const doc = new Student({});
    const err = doc.validateSync();

    expect(err.errors.name).toBeDefined();
    expect(err.errors.grade).toBeDefined();
    expect(err.errors.educator).toBeDefined();
  });

  it('passes validation when all required fields are provided', () => {
    const doc = new Student({
      name: 'Alex',
      grade: '5th',
      educator: new mongoose.Types.ObjectId(),
      progress: 42,
    });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.progress).toBe(42);
  });
});
