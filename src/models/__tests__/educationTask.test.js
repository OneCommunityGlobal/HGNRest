describe('educationTask model', () => {
  test('exports EducationTask model with review fields', () => {
    jest.resetModules();
    const EducationTask = require('../educationTask');
    const { paths } = EducationTask.schema;

    expect(EducationTask.modelName).toBe('EducationTask');
    expect(paths.reviewStatus).toBeDefined();
    expect(paths.marksGiven).toBeDefined();
    expect(paths.collaborativeFeedback).toBeDefined();
    expect(paths.privateNotes).toBeDefined();
    expect(paths.pageComments).toBeDefined();
    expect(paths.changeRequests).toBeDefined();
    expect(paths.weightage).toBeDefined();
    expect(paths.submittedAt).toBeDefined();
    expect(paths.status.enumValues).toEqual(
      expect.arrayContaining(['submitted', 'in_review', 'changes_requested', 'graded']),
    );
  });
});
