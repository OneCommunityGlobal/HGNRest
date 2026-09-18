const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLog');
const usersProfiles = require('../models/userProfile');
const logger = require('../startup/logger');
const { hasPermission } = require('../utilities/permissions');

// Helper functions declared outside the request lifecycle
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

const sanitizeObjectIds = (values) =>
  values
    .filter((v) => mongoose.Types.ObjectId.isValid(v))
    .map((v) => new mongoose.Types.ObjectId(v));

const resolveAssistedUsers = async (assistedUsersFromClient) => {
  const validAssistanceTypes = ActivityLog.schema
    .path('assisted_users')
    .schema.path('assistance_type').enumValues;

  const userIds = sanitizeObjectIds(assistedUsersFromClient.map((u) => u.userId));
  if (userIds.length !== assistedUsersFromClient.length) {
    const err = new Error('One or more provided userIds are invalid');
    err.status = 400;
    throw err;
  }

  const profiles = await usersProfiles.find({ _id: { $in: userIds } }).select('firstName lastName');

  return profiles.map((user) => {
    const clientObj = assistedUsersFromClient.find((u) => String(u.userId) === String(user._id));

    const { assistanceType } = clientObj || {};
    if (!validAssistanceTypes.includes(assistanceType)) {
      const err = new Error(`Invalid assistanceType for user ${user._id}: ${assistanceType}`);
      err.status = 400;
      throw err;
    }

    return {
      user_id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      assisted_at: new Date(),
      assistance_type: assistanceType,
    };
  });
};

const handleControllerError = (err, res, methodName, requestor) => {
  logger.logException(err, methodName, { requestor });
  const status = err.status || 500;
  const error = status < 500 ? err.message : 'An unexpected error occurred';
  return res.status(status).json({ error });
};

async function fetchStudentDailyLogsByStaff(req, res) {
  try {
    const { studentId } = req.params;

    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId format' });
    }

    const canReadActivityLogs = await hasPermission(req.body?.requestor, 'readActivityLogs');
    if (!canReadActivityLogs) {
      return res.status(403).json({ error: 'You are not authorized to view student logs' });
    }

    const sanitizedStudentId = new mongoose.Types.ObjectId(studentId);

    const logs = await ActivityLog.find({ actor_id: sanitizedStudentId })
      .sort({ created_at: -1 })
      .select('action_type metadata created_at actor_id is_assisted assisted_users');

    return res.json(formatLogs(logs));
  } catch (err) {
    return handleControllerError(err, res, 'fetchStudentDailyLogsByStaff', req.body?.requestor);
  }
}

const activityLogController = () => {
  async function fetchStudentDailyLog(req, res) {
    try {
      const studentId = req.body?.requestor?.requestorId;
      const requestedStudentId = req.query?.studentId;

      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ error: 'Invalid studentId format' });
      }
      const sanitizedStudentId = new mongoose.Types.ObjectId(studentId);

      if (requestedStudentId) {
        if (!mongoose.Types.ObjectId.isValid(requestedStudentId)) {
          return res.status(400).json({ error: 'Invalid studentId format' });
        }
        if (requestedStudentId !== String(sanitizedStudentId)) {
          return res.status(403).json({ error: "Forbidden: Cannot access another student's log" });
        }
      }

      const logs = await ActivityLog.find({ actor_id: sanitizedStudentId })
        .sort({ created_at: -1 })
        .select('action_type metadata created_at actor_id is_assisted assisted_users');

      return res.json(formatLogs(logs));
    } catch (err) {
      return handleControllerError(err, res, 'fetchStudentDailyLog', req.body?.requestor);
    }
  }

  async function createStudentDailyLog(req, res) {
    try {
      const currentUser = req.body?.requestor;
      const {
        actionType,
        entityId,
        metadata,
        isAssisted: isAssistedFromClient,
        assistedUsers: assistedUsersFromClient,
      } = req.body;

      if (!actionType || !entityId) {
        return res.status(400).json({ error: 'actionType and entityId are required' });
      }

      const validActionTypes = ActivityLog.schema.path('action_type').enumValues;

      if (!validActionTypes.includes(actionType)) {
        return res.status(400).json({
          error: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}`,
        });
      }

      let isAssisted = false;
      let assistedUsers = null;

      if (isAssistedFromClient) {
        const canUpdateActivityLogs = await hasPermission(
          req.body?.requestor,
          'updateActivityLogs',
        );
        if (!canUpdateActivityLogs) {
          return res.status(403).json({
            error: 'Only educators or administrators can set the assisted flag',
          });
        }

        if (
          !assistedUsersFromClient ||
          !Array.isArray(assistedUsersFromClient) ||
          assistedUsersFromClient.length === 0
        ) {
          return res.status(400).json({
            error: 'You must provide at least one assisted user if isAssisted is true',
          });
        }

        isAssisted = true;
        assistedUsers = await resolveAssistedUsers(assistedUsersFromClient);
      }

      const logData = {
        actor_id: currentUser?.requestorId,
        action_type: actionType,
        entity_id: entityId,
        metadata: metadata || {},
        created_at: new Date(),
        is_assisted: isAssisted,
        assisted_users: assistedUsers,
      };

      const newLog = await ActivityLog.create(logData);

      const formattedLogs = formatLogs([newLog]);
      const responseLog = formattedLogs[0];

      return res.status(201).json({
        message: 'Activity log created successfully',
        log: responseLog,
      });
    } catch (err) {
      return handleControllerError(err, res, 'createStudentDailyLog', req.body?.requestor);
    }
  }

  async function updateStudentDailyLog(req, res) {
    try {
      const { logId } = req.params;
      const { isAssisted: isAssistedFromClient, assistedUsers: assistedUsersFromClient } = req.body;

      if (!logId || !mongoose.Types.ObjectId.isValid(logId)) {
        return res.status(400).json({ error: 'Invalid or missing logId' });
      }

      const canUpdateActivityLogs = await hasPermission(req.body?.requestor, 'updateActivityLogs');
      if (!canUpdateActivityLogs) {
        return res.status(403).json({
          error: 'Only educators or administrators can update the assisted flag',
        });
      }

      const log = await ActivityLog.findById(logId);
      if (!log) return res.status(404).json({ error: 'Activity log not found' });

      let assistedUsers = [];
      if (isAssistedFromClient) {
        if (
          !assistedUsersFromClient ||
          !Array.isArray(assistedUsersFromClient) ||
          assistedUsersFromClient.length === 0
        ) {
          return res.status(400).json({
            error: 'You must provide at least one assisted user if isAssisted is true',
          });
        }

        assistedUsers = await resolveAssistedUsers(assistedUsersFromClient);
      }

      log.is_assisted = Boolean(isAssistedFromClient);
      log.assisted_users = assistedUsers;
      await log.save();

      const formattedLog = formatLogs([log])[0];

      return res.status(200).json({
        message: 'Activity log updated successfully',
        log: formattedLog,
      });
    } catch (err) {
      return handleControllerError(err, res, 'updateStudentDailyLog', req.body?.requestor);
    }
  }

  return {
    fetchStudentDailyLog,
    fetchStudentDailyLogsByStaff,
    createStudentDailyLog,
    updateStudentDailyLog,
  };
};

module.exports = activityLogController;
