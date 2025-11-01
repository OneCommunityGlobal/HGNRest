const ActivityLog = require('../models/activityLog');
const usersProfiles = require('../models/userProfile');

const activityLogController = function () {
  // Format response - only include assisted_users if is_assisted is true
  const formatLogs = (logs) =>
    logs.map((log) => ({
      log_id: log._id,
      action_type: log.action_type,
      metadata: log.metadata,
      created_at: log.created_at,
      actor_id: log.actor_id,
      is_assisted: log.is_assisted,
      ...(log.is_assisted &&
        log.assisted_users && {
          assisted_users: log.assisted_users.map((au) => ({
            user_id: au.user_id,
            name: au.name,
            assisted_at: au.assisted_at,
            assistance_type: au.assistance_type,
          })),
        }),
    }));
  async function fetchStudentDailyLog(req, res) {
    try {
      const studentId = req.body.requestor.requestorId;
      const requestedStudentId = req.query.studentId;

      if (requestedStudentId && requestedStudentId !== String(studentId)) {
        return res.status(403).json({ error: "Forbidden: Cannot access another student's log" });
      }

      const logs = await ActivityLog.find({ actor_id: studentId })
        .sort({ created_at: -1 })
        .select('action_type metadata created_at actor_id is_assisted assisted_users');

      res.json(formatLogs(logs));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
  async function createStudentDailyLog(req, res) {
    try {
      const currentUser = req.body.requestor;
      const {
        actionType,
        entityId,
        metadata,
        isAssisted,
        assistedUsers: assistedUsersFromClient,
      } = req.body;

      // Required fields
      if (!actionType || !entityId) {
        return res.status(400).json({ error: 'actionType and entityId are required' });
      }

      // Get valid enums from schema
      const validActionTypes = ActivityLog.schema.path('action_type').enumValues;
      const validAssistanceTypes = ActivityLog.schema
        .path('assisted_users')
        .schema.path('assistance_type').enumValues;

      // Validate actionType
      if (!validActionTypes.includes(actionType)) {
        return res.status(400).json({
          error: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}`,
        });
      }

      let assistedUsers = null;

      // Optional assisted users handling
      if (isAssisted) {
        if (!assistedUsersFromClient || assistedUsersFromClient.length === 0) {
          return res.status(400).json({
            error: 'You must provide at least one assisted user if isAssisted is true',
          });
        }

        // Fetch users from DB
        const userIds = assistedUsersFromClient.map((u) => u.userId);
        const usersProfile = await usersProfiles
          .find({ _id: { $in: userIds } })
          .select('firstName lastName');

        // Map assisted users with validation
        assistedUsers = usersProfile.map((user) => {
          const clientObj = assistedUsersFromClient.find(
            (u) => String(u.userId) === String(user._id),
          );

          const { assistanceType } = clientObj;

          if (!validAssistanceTypes.includes(assistanceType)) {
            throw new Error(`Invalid assistanceType for user ${user._id}: ${assistanceType}`);
          }

          return {
            user_id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            assisted_at: new Date(),
            assistance_type: assistanceType,
          };
        });
      }

      // Build log object
      const logData = {
        actor_id: currentUser.requestorId,
        action_type: actionType,
        entity_id: entityId,
        metadata: metadata || {},
        created_at: new Date(),
        is_assisted: Boolean(isAssisted),
        assisted_users: assistedUsers,
      };

      const newLog = await ActivityLog.create(logData);

      // Format response
      const responseLog = {
        logId: newLog._id,
        actorId: newLog.actor_id,
        actionType: newLog.action_type,
        entityId: newLog.entity_id,
        metadata: newLog.metadata,
        createdAt: newLog.created_at,
        isAssisted: newLog.is_assisted,
        ...(newLog.is_assisted && newLog.assisted_users
          ? {
              assistedUsers: newLog.assisted_users.map((au) => ({
                userId: au.user_id,
                name: au.name,
                assistedAt: au.assisted_at,
                assistanceType: au.assistance_type,
              })),
            }
          : {}),
      };

      return res.status(201).json({
        message: 'Activity log created successfully',
        log: responseLog,
      });
    } catch (err) {
      console.error('Error creating activity log:', err);
      return res.status(500).json({ error: err.message });
    }
  }
  async function fetchEducatorDailyLog(req, res) {
    try {
      const { studentId } = req.params;
      const currentUser = req.body.requestor;
      if (!studentId) return res.status(400).json({ error: 'Missing studentId' });
      // Add correct rule once you get it so the permission is correct
      if (currentUser.role !== 'educator' && currentUser.role !== 'Administrator') {
        return res.status(403).json({ error: 'Only Educators can view students logs' });
      }

      const logs = await ActivityLog.find({ actor_id: studentId })
        .sort({ created_at: -1 })
        .select('action_type metadata created_at actor_id is_assisted assisted_users');

      res.json(formatLogs(logs));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  return {
    fetchStudentDailyLog,
    fetchEducatorDailyLog,
    createStudentDailyLog,
  };
};

module.exports = activityLogController;
