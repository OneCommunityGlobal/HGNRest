const { isTaskActiveForUser, isTaskCompletedForUser } = require('./taskHelper');

describe('taskHelper dashboard task filters', () => {
  const userId = 'user123';

  const makeTask = (overrides = {}) => ({
    isActive: true,
    resources: [{ userID: userId, completedTask: false }],
    ...overrides,
  });

  test('isTaskCompletedForUser returns true when user resource has completedTask true', () => {
    const task = makeTask({ resources: [{ userID: userId, completedTask: true }] });
    expect(isTaskCompletedForUser(task, userId)).toBe(true);
  });

  test('isTaskCompletedForUser returns false for active assignment', () => {
    expect(isTaskCompletedForUser(makeTask(), userId)).toBe(false);
  });

  test('isTaskActiveForUser returns false for completed assignment', () => {
    const task = makeTask({ resources: [{ userID: userId, completedTask: true }] });
    expect(isTaskActiveForUser(task, userId)).toBe(false);
  });

  test('isTaskActiveForUser returns true for inactive tasks when not completed', () => {
    expect(isTaskActiveForUser(makeTask({ isActive: false }), userId)).toBe(true);
  });

  test('isTaskActiveForUser returns true for active non-completed assignment', () => {
    expect(isTaskActiveForUser(makeTask(), userId)).toBe(true);
  });

  test('per-user isolation: completed for A, active for B', () => {
    const task = makeTask({
      resources: [
        { userID: 'userA', completedTask: true },
        { userID: 'userB', completedTask: false },
      ],
    });
    expect(isTaskActiveForUser(task, 'userA')).toBe(false);
    expect(isTaskActiveForUser(task, 'userB')).toBe(true);
  });
});
