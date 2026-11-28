const mongoose = require('mongoose');
const EducationTask = require('./educationTask');
const LessonPlan = require('./lessonPlan');
const LessonPlanLog = require('./lessonPlanLog');
const UserProfile = require('./userProfile');

const objectId = () => new mongoose.Types.ObjectId();

describe('lesson-plan assignment model schemas', () => {
  test('persists identified subtasks and editor ownership in the lesson-plan collection', () => {
    const plan = new LessonPlan({
      title: 'Research',
      startDate: new Date('2030-01-01'),
      endDate: new Date('2030-02-01'),
      createdBy: objectId(),
      lastEditedBy: objectId(),
      subTasks: [{ name: 'Write a summary', type: 'Write-only', passMark: '8/10', weight: '40%' }],
    });

    expect(plan.collection.collectionName).toBe('lessonplans');
    expect(plan.subTasks[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(plan.validateSync()).toBeUndefined();
  });

  test('requires subtask names', () => {
    const plan = new LessonPlan({
      title: 'Research',
      startDate: new Date('2030-01-01'),
      endDate: new Date('2030-02-01'),
      createdBy: objectId(),
      subTasks: [{ type: 'Write-only' }],
    });

    expect(plan.validateSync().errors['subTasks.0.name']).toBeDefined();
  });

  test('supports subtask assignment metadata while allowing legacy tasks', () => {
    const task = new EducationTask({
      name: 'Write a summary',
      lessonPlanId: objectId(),
      subTaskId: objectId(),
      studentId: objectId(),
      assignedBy: objectId(),
      title: 'Write a summary',
      assignedDate: new Date('2030-01-01'),
      dueDate: new Date('2030-01-15'),
    });
    const legacyTask = new EducationTask({
      name: 'Legacy task',
      lessonPlanId: objectId(),
      studentId: objectId(),
    });

    expect(task.validateSync()).toBeUndefined();
    expect(task.subTaskId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(legacyTask.validateSync()).toBeUndefined();
    expect(
      EducationTask.schema
        .indexes()
        .some(
          ([keys, options]) =>
            keys.subTaskId === 1 &&
            options.unique &&
            options.partialFilterExpression?.subTaskId?.$type === 'objectId',
        ),
    ).toBe(true);
  });

  test('requires lesson-plan log identity and action fields', () => {
    const invalidLog = new LessonPlanLog({});
    const validLog = new LessonPlanLog({
      lessonPlanId: objectId(),
      editorId: objectId(),
      action: 'Manual Assignment',
    });

    expect(invalidLog.validateSync().errors.lessonPlanId).toBeDefined();
    expect(invalidLog.validateSync().errors.editorId).toBeDefined();
    expect(invalidLog.validateSync().errors.action).toBeDefined();
    expect(validLog.validateSync()).toBeUndefined();
    expect(validLog.logDateTime).toBeInstanceOf(Date);
    expect(LessonPlanLog.collection.collectionName).toBe('lessonplanlogs');
  });

  test('references user profiles for assigned teacher and learning-support relations', () => {
    expect(
      UserProfile.schema.path('educationProfiles.teacher.assignedStudents').caster.options.ref,
    ).toBe('userProfile');
    expect(
      UserProfile.schema.path('educationProfiles.learningSupport.assignedTeachers').caster.options
        .ref,
    ).toBe('userProfile');
  });
});
