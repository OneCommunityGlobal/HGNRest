const TaskChangeLog = require('../models/taskChangeLog');

/**
 * TaskChangeTracker middleware for logging task changes
 */
class TaskChangeTracker {
  /**
   * Log changes to a task
   * @param {string} taskId - The task ID
   * @param {Object} oldTask - The task state before changes
   * @param {Object} newTask - The task state after changes
   * @param {Object} user - The user making the changes
   * @param {Object} req - The request object
   */
  static async logChanges(taskId, oldTask, newTask, user, req) {
    // Suppress unused parameter warning for req (may be used in future)
    // eslint-disable-next-line no-unused-vars
    const _req = req;
    try {
      // Find the differences between old and new task
      const changes = this.findDifferences(oldTask, newTask);

      if (Object.keys(changes).length === 0) {
        // No changes to log
        return;
      }

      // Determine the action type
      const action = this.determineAction(oldTask, newTask, changes);

      // Create description
      const description = this.createDescription(changes, action);

      // Create the change log entry
      const changeLog = new TaskChangeLog({
        taskId,
        userId: user._id,
        changes,
        action,
        description,
        timestamp: new Date(),
      });

      await changeLog.save();

      console.log(`[TaskChangeTracker] Logged changes for task ${taskId} by user ${user._id}`);
    } catch (error) {
      console.error('[TaskChangeTracker] Error logging changes:', error);
      // Don't throw the error to avoid breaking the main operation
    }
  }

  /**
   * Find differences between old and new task objects
   * @param {Object} oldTask - Old task state
   * @param {Object} newTask - New task state
   * @returns {Object} Object containing the differences
   */
  static findDifferences(oldTask, newTask) {
    const changes = {};
    const fieldsToTrack = [
      'taskName',
      'description',
      'category',
      'priority',
      'status',
      'hoursBest',
      'hoursWorst',
      'hoursMost',
      'hoursLogged',
      'estimatedHours',
      'startedDatetime',
      'dueDatetime',
      'isAssigned',
      'isActive',
      'categoryOverride',
      'categoryLocked',
    ];

    fieldsToTrack.forEach((field) => {
      if (oldTask[field] !== newTask[field]) {
        changes[field] = {
          from: oldTask[field],
          to: newTask[field],
        };
      }
    });

    // Check for resource changes
    if (JSON.stringify(oldTask.resources) !== JSON.stringify(newTask.resources)) {
      changes.resources = {
        from: oldTask.resources,
        to: newTask.resources,
      };
    }

    return changes;
  }

  /**
   * Determine the type of action based on changes
   * @param {Object} oldTask - Old task state
   * @param {Object} newTask - New task state
   * @param {Object} changes - The changes made
   * @returns {string} The action type
   */
  static determineAction(oldTask, newTask, changes) {
    // Check for assignment changes
    if (changes.isAssigned) {
      return newTask.isAssigned ? 'assign' : 'unassign';
    }

    // Check for status changes
    if (changes.status) {
      return 'status_change';
    }

    // Default to update for other changes
    return 'update';
  }

  /**
   * Create a human-readable description of the changes
   * @param {Object} changes - The changes made
   * @param {string} action - The action type
   * @returns {string} Description of the changes
   */
  static createDescription(changes, action) {
    // Suppress unused parameter warning for action (may be used in future)
    // eslint-disable-next-line no-unused-vars
    const _action = action;
    const changeDescriptions = [];

    Object.keys(changes).forEach((field) => {
      const change = changes[field];
      switch (field) {
        case 'taskName':
          changeDescriptions.push(`Task name changed from "${change.from}" to "${change.to}"`);
          break;
        case 'category':
          changeDescriptions.push(`Category changed from "${change.from}" to "${change.to}"`);
          break;
        case 'priority':
          changeDescriptions.push(`Priority changed from "${change.from}" to "${change.to}"`);
          break;
        case 'status':
          changeDescriptions.push(`Status changed from "${change.from}" to "${change.to}"`);
          break;
        case 'isAssigned':
          changeDescriptions.push(`Assignment changed from ${change.from} to ${change.to}`);
          break;
        case 'resources':
          changeDescriptions.push(`Resources updated`);
          break;
        default:
          changeDescriptions.push(`${field} updated`);
      }
    });

    return changeDescriptions.join(', ');
  }
}

module.exports = TaskChangeTracker;
