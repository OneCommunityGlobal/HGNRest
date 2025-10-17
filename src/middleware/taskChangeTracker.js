const TaskChangeLog = require('../models/taskChangeLog');

class TaskChangeTracker {
  static async logChanges(taskId, oldTask, newTask, user, req) {
    try {
      const changes = this.detectChanges(oldTask, newTask);

      const changePromises = changes.map(async (change) => {
        const entry = await TaskChangeLog.create({
          taskId,
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email,
          changeType: change.type,
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          oldValueFormatted: change.oldValueFormatted,
          newValueFormatted: change.newValueFormatted,
          changeDescription: change.description,
          metadata: {
            source: 'web_ui',
            reason: req.body.changeReason, // Optional field from frontend
          },
        });
        return entry;
      });

      const changeEntries = await Promise.all(changePromises);

      // Link related changes
      if (changeEntries.length > 1) {
        const entryIds = changeEntries.map((e) => e._id);
        await TaskChangeLog.updateMany(
          { _id: { $in: entryIds } },
          { $set: { 'metadata.relatedChanges': entryIds } },
        );
      }

      return changeEntries;
    } catch (error) {
      console.error('Error logging task changes:', error);
      return [];
    }
  }

  static detectChanges(oldTask, newTask) {
    const changes = [];

    // Define fields to track
    const fieldsToTrack = [
      {
        field: 'taskName',
        type: 'field_change',
        formatter: (val) => val || 'Not set',
      },
      {
        field: 'priority',
        type: 'priority_change',
        formatter: (val) => val || 'Not set',
      },
      {
        field: 'status',
        type: 'status_change',
        formatter: (val) => val || 'Not started',
      },
      {
        field: 'dueDatetime',
        type: 'deadline_change',
        formatter: (val) => (val ? new Date(val).toLocaleDateString() : 'No due date'),
      },
      {
        field: 'estimatedHours',
        type: 'hours_change',
        formatter: (val) => (val ? `${val} hours` : '0 hours'),
      },
      {
        field: 'hoursBest',
        type: 'hours_change',
        formatter: (val) => (val ? `${val} hours` : '0 hours'),
      },
      {
        field: 'hoursWorst',
        type: 'hours_change',
        formatter: (val) => (val ? `${val} hours` : '0 hours'),
      },
      {
        field: 'hoursMost',
        type: 'hours_change',
        formatter: (val) => (val ? `${val} hours` : '0 hours'),
      },
      {
        field: 'hoursLogged',
        type: 'hours_change',
        formatter: (val) => (val ? `${val} hours` : '0 hours'),
      },
      {
        field: 'resources',
        type: 'assignment_change',
        formatter: (resources) => {
          if (!resources || resources.length === 0) return 'None assigned';
          return resources.map((r) => r.name || 'Unknown').join(', ');
        },
      },
      {
        field: 'startedDatetime',
        type: 'deadline_change',
        formatter: (val) => (val ? new Date(val).toLocaleDateString() : 'No start date'),
      },
      {
        field: 'whyInfo',
        type: 'field_change',
        formatter: (val) => val || 'Not set',
      },
      {
        field: 'intentInfo',
        type: 'field_change',
        formatter: (val) => val || 'Not set',
      },
      {
        field: 'endstateInfo',
        type: 'field_change',
        formatter: (val) => val || 'Not set',
      },
      {
        field: 'classification',
        type: 'field_change',
        formatter: (val) => val || 'Not set',
      },
    ];

    fieldsToTrack.forEach((fieldConfig) => {
      const oldValue = oldTask[fieldConfig.field];
      const newValue = newTask[fieldConfig.field];

      // Special handling for arrays (resources)
      if (fieldConfig.field === 'resources' && !this.arraysEqual(oldValue, newValue)) {
        changes.push({
          type: fieldConfig.type,
          field: fieldConfig.field,
          oldValue,
          newValue,
          oldValueFormatted: fieldConfig.formatter(oldValue),
          newValueFormatted: fieldConfig.formatter(newValue),
          description: `Changed ${fieldConfig.field} from "${fieldConfig.formatter(oldValue)}" to "${fieldConfig.formatter(newValue)}"`,
        });
      } else if (fieldConfig.field !== 'resources' && oldValue !== newValue) {
        // Regular field comparison
        changes.push({
          type: fieldConfig.type,
          field: fieldConfig.field,
          oldValue,
          newValue,
          oldValueFormatted: fieldConfig.formatter(oldValue),
          newValueFormatted: fieldConfig.formatter(newValue),
          description: `Changed ${fieldConfig.field} from "${fieldConfig.formatter(oldValue)}" to "${fieldConfig.formatter(newValue)}"`,
        });
      }
    });

    return changes;
  }

  static arraysEqual(arr1, arr2) {
    // Handle null/undefined cases
    if (!arr1 && !arr2) return true;
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;

    // For resources, compare by userID with better error handling
    try {
      const ids1 = arr1
        .map((r) => {
          if (!r) return null;
          // Convert ObjectId to string for comparison
          const id = r.userID || r._id;
          return id ? id.toString() : null;
        })
        .filter((id) => id !== null)
        .sort();

      const ids2 = arr2
        .map((r) => {
          if (!r) return null;
          // Convert ObjectId to string for comparison
          const id = r.userID || r._id;
          return id ? id.toString() : null;
        })
        .filter((id) => id !== null)
        .sort();

      // If different number of valid IDs, arrays are different
      if (ids1.length !== ids2.length) return false;

      return ids1.every((id, index) => id === ids2[index]);
    } catch (error) {
      console.error('Error comparing resource arrays:', error);
      // Fallback to JSON comparison if ID comparison fails
      return JSON.stringify(arr1) === JSON.stringify(arr2);
    }
  }
}

module.exports = TaskChangeTracker;
