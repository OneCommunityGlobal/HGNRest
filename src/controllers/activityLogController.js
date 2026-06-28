const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLog');
const usersProfiles = require('../models/userProfile');
const logger = require('../startup/logger');

const activityLogController = function () {
  const validRoles = new Set(['Educator', 'Administrator']);

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
      throw new Error('One or more provided userIds are invalid');
    }

    const profiles = await usersProfiles
      .find({ _id: { $in: userIds } })
      .select('firstName lastName');

    return profiles.map((user) => {
      const clientObj = assistedUsersFromClient.find((u) => String(u.userId) === String(user._id));

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
  };

  async function fetchStudentDailyLog(req, res) {
    try {
      const studentId = req.body.requestor.requestorId;
      const requestedStudentId = req.query.studentId;

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
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

      res.json(formatLogs(logs));
    } catch (err) {
      logger.logException(err, 'fetchStudentDailyLog', { requestor: req.body.requestor });
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }

  async function createStudentDailyLog(req, res) {
    try {
      const currentUser = req.body.requestor;
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
        if (!validRoles.has(currentUser.role)) {
          return res.status(403).json({
            error: 'Only educators or administrators can set the assisted flag',
          });
        }

        isAssisted = true;

        if (!assistedUsersFromClient || assistedUsersFromClient.length === 0) {
          return res.status(400).json({
            error: 'You must provide at least one assisted user if isAssisted is true',
          });
        }

        assistedUsers = await resolveAssistedUsers(assistedUsersFromClient);
      }

      const logData = {
        actor_id: currentUser.requestorId,
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
      logger.logException(err, 'createStudentDailyLog', { requestor: req.body.requestor });
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }

  async function updateStudentDailyLog(req, res) {
    try {
      const { logId } = req.params;
      const currentUser = req.body.requestor;
      const { isAssisted: isAssistedFromClient, assistedUsers: assistedUsersFromClient } = req.body;

      if (!logId || !mongoose.Types.ObjectId.isValid(logId)) {
        return res.status(400).json({ error: 'Invalid or missing logId' });
      }

      if (!validRoles.has(currentUser.role)) {
        return res.status(403).json({
          error: 'Only educators or administrators can update the assisted flag',
        });
      }

      const log = await ActivityLog.findById(logId);
      if (!log) return res.status(404).json({ error: 'Activity log not found' });

      let assistedUsers = [];
      if (isAssistedFromClient) {
        if (!assistedUsersFromClient || assistedUsersFromClient.length === 0) {
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
      logger.logException(err, 'updateStudentDailyLog', { requestor: req.body.requestor });
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }

  async function fetchEducatorDailyLog(req, res) {
    try {
      const { studentId } = req.params;
      const currentUser = req.body.requestor;
      if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ error: 'Invalid studentId format' });
      }
      const sanitizedStudentId = new mongoose.Types.ObjectId(studentId);

      if (!validRoles.has(currentUser.role)) {
        return res.status(403).json({ error: 'Only Educators can view students logs' });
      }

      const logs = await ActivityLog.find({ actor_id: sanitizedStudentId })
        .sort({ created_at: -1 })
        .select('action_type metadata created_at actor_id is_assisted assisted_users');

      res.json(formatLogs(logs));
    } catch (err) {
      logger.logException(err, 'fetchEducatorDailyLog', { requestor: req.body.requestor });
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }

  return {
    fetchStudentDailyLog,
    fetchEducatorDailyLog,
    createStudentDailyLog,
    updateStudentDailyLog,
  };
};

module.exports = activityLogController;
