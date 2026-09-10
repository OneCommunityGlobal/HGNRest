const mongoose = require('mongoose');

describe('bmdashboard studentTask model', () => {
  it('exports a mongoose model with the expected schema paths', () => {
    delete mongoose.connection.models.StudentTasks;
    jest.resetModules();

    const StudentTask = require('./studentTask');

    expect(StudentTask.modelName).toBe('StudentTasks');
    expect(StudentTask.schema.path('studentId')).toBeDefined();
    expect(StudentTask.schema.path('taskId')).toBeDefined();
    expect(StudentTask.schema.path('status')).toBeDefined();
    expect(StudentTask.schema.path('deadline')).toBeDefined();
    expect(StudentTask.schema.path('assignment_timestamp')).toBeDefined();
    expect(StudentTask.schema.path('lessonPlanId')).toBeDefined();
    expect(StudentTask.schema.path('subject')).toBeDefined();
    expect(StudentTask.schema.path('colorLevel')).toBeDefined();
    expect(StudentTask.schema.path('activityGroup')).toBeDefined();
    expect(StudentTask.schema.path('teachingStrategy')).toBeDefined();
    expect(StudentTask.schema.path('lifeStrategy')).toBeDefined();
    expect(StudentTask.schema.path('isAutoAssigned')).toBeDefined();
    expect(StudentTask.schema.path('createdAt')).toBeDefined();
    expect(StudentTask.schema.path('updatedAt')).toBeDefined();
    expect(StudentTask.schema.path('completedAt')).toBeDefined();
  });
});
