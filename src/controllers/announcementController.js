const mongoose = require('mongoose');
const Announcement = require('../models/announcements');
const LOGGER = require('../startup/logger');
const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const UserProfile = require('../models/userProfile');

const canManage = (requestor) =>
  ['Administrator', 'Owner', 'Teacher', 'Program Manager'].includes(requestor?.role);
const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function badRequest(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateContent(title, body, audience, input) {
  if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
    throw badRequest('Title and body are required');
  }
  if (!['students', 'educators', 'support', 'all'].includes(audience)) {
    throw badRequest('Invalid audience type. Must be one of: students, educators, support, all');
  }
  if (hasOwn(input, 'recipientStudentIds')) {
    throw badRequest('Recipients must be resolved from a group, not supplied directly');
  }
}

async function resolveGroup(groupId, educatorId, audience) {
  if (!validId(groupId)) throw badRequest('Invalid group ID');
  if (audience !== 'students') throw badRequest('Group announcements must target students');
  const group = await StudentGroup.findOne({ _id: groupId, educator_id: educatorId });
  if (!group) throw badRequest('Group not found', 404);
  const members = await StudentGroupMember.find({ group_id: groupId }).select('student_id');
  const ids = [...new Set(members.map((member) => String(member.student_id)).filter(validId))];
  const students = await UserProfile.find({ _id: { $in: ids }, role: 'student' }).select('_id');
  const recipientStudentIds = [...new Set(students.map((student) => String(student._id)))];
  if (!recipientStudentIds.length) throw badRequest('Group has no valid student members');
  return { groupId, recipientStudentIds };
}

function sendError(res, error) {
  if (error.status) return res.status(error.status).send({ error: error.message });
  LOGGER.logException(error);
  return res.status(500).send({ error: 'Internal server error' });
}

/**
 * API controller for announcements service.
 * Handles CRUD operations for announcements with role-based access control.
 */

const announcementController = function () {
  /**
   * Creates a new announcement (Educator/Admin/Owner only)
   * POST /educator/announcements
   * @param {Object} req - The request object containing title, body, audience
   * @param {Object} res - The response object
   * @returns {void}
   */
  const createAnnouncement = async function (req, res) {
    const { title, body, audience } = req.body;
    const { requestor } = req.body;

    // Check if user has permission to create announcements
    if (!canManage(requestor)) {
      res.status(403).send({ error: 'Unauthorized: Only educators can create announcements' });
      return;
    }

    // Validate required fields
    if (!title || !body) {
      res.status(400).send({ error: 'Title and body are required' });
      return;
    }

    // Validate audience if provided
    const validAudiences = ['students', 'educators', 'support', 'all'];
    if (audience && !validAudiences.includes(audience)) {
      res
        .status(400)
        .send({
          error: 'Invalid audience type. Must be one of: students, educators, support, all',
        });
      return;
    }

    try {
      validateContent(title, body, audience || 'students', req.body);
      const targeting = hasOwn(req.body, 'groupId')
        ? await resolveGroup(req.body.groupId, requestor.requestorId, audience || 'students')
        : {};
      // Get the next announcement_id
      const lastAnnouncement = await Announcement.findOne().sort({ announcement_id: -1 });
      const nextAnnouncementId = lastAnnouncement ? lastAnnouncement.announcement_id + 1 : 1;

      const announcement = new Announcement({
        announcement_id: nextAnnouncementId,
        user_id: requestor.requestorId,
        title: title.trim(),
        body: body.trim(),
        audience: audience || 'students',
        ...targeting,
      });

      const savedAnnouncement = await announcement.save();

      // Populate creator info
      await savedAnnouncement.populate('creatorInfo').execPopulate();

      res.status(201).send({
        success: true,
        message: 'Announcement created successfully',
        data: savedAnnouncement,
      });
    } catch (err) {
      sendError(res, err);
    }
  };

  // Omitted groupId preserves the recipient snapshot. Explicit null restores broad targeting.
  const updateAnnouncement = async function (req, res) {
    const { requestor } = req.body;
    if (!canManage(requestor)) {
      return res
        .status(403)
        .send({ error: 'Unauthorized: Only educators can update announcements' });
    }
    try {
      if (!validId(req.params.announcementId)) throw badRequest('Invalid announcement ID');
      const announcement = await Announcement.findOne({
        _id: req.params.announcementId,
        user_id: requestor.requestorId,
      });
      if (!announcement) throw badRequest('Announcement not found', 404);
      const title = req.body.title === undefined ? announcement.title : req.body.title;
      const body = req.body.body === undefined ? announcement.body : req.body.body;
      const audience = req.body.audience === undefined ? announcement.audience : req.body.audience;
      validateContent(title, body, audience, req.body);
      if (hasOwn(req.body, 'groupId')) {
        const targeting =
          req.body.groupId === null
            ? { groupId: undefined, recipientStudentIds: undefined }
            : await resolveGroup(req.body.groupId, requestor.requestorId, audience);
        announcement.set(targeting);
      }
      if (announcement.recipientStudentIds !== undefined && audience !== 'students') {
        throw badRequest('Group announcements must target students');
      }
      announcement.set({ title: title.trim(), body: body.trim(), audience });
      await announcement.save();
      await announcement.populate('creatorInfo').execPopulate();
      return res
        .status(200)
        .send({ success: true, message: 'Announcement updated successfully', data: announcement });
    } catch (err) {
      return sendError(res, err);
    }
  };

  /**
   * Gets announcements for students
   * GET /student/announcements
   * @param {Object} req - The request object
   * @param {Object} res - The response object
   * @returns {void}
   */
  const getStudentAnnouncements = async function (req, res) {
    const { page = 1, limit = 10 } = req.query;
    const requestorId = req.body.requestor?.requestorId;
    if (!validId(requestorId)) return res.status(401).send({ error: 'Authentication required' });
    const filter = {
      $or: [
        // Everyone is broad and readable by any authenticated portal user.
        {
          audience: { $in: ['students', 'support', 'all'] },
          recipientStudentIds: { $exists: false },
          groupId: { $exists: false },
        },
        { audience: 'students', recipientStudentIds: mongoose.Types.ObjectId(requestorId) },
      ],
    };

    // Temporarily commented out for testing - allows any user to access student announcements
    // if (requestor.role !== 'Student') {
    //   res.status(403).send({ error: 'Unauthorized: This endpoint is for students only' });
    //   return;
    // }

    try {
      const skip = (page - 1) * limit;

      // Get announcements that are relevant to students
      const announcements = await Announcement.find(filter)
        .select('-recipientStudentIds')
        .populate('creatorInfo', 'firstName lastName email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10));

      const total = await Announcement.countDocuments(filter);

      res.status(200).send({
        success: true,
        data: announcements,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit, 10),
        },
      });
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal server error' });
    }
  };

  /**
   * Gets announcements created by the current user (any user can view their own announcements)
   * GET /educator/announcements
   * @param {Object} req - The request object
   * @param {Object} res - The response object
   * @returns {void}
   */
  const getEducatorAnnouncements = async function (req, res) {
    const { requestor } = req.body;
    const { page = 1, limit = 10 } = req.query;

    try {
      const skip = (page - 1) * limit;

      // Get announcements created by the current user
      const announcements = await Announcement.find({
        user_id: requestor.requestorId,
      })
        .populate('creatorInfo', 'firstName lastName email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10));

      const total = await Announcement.countDocuments({
        user_id: requestor.requestorId,
      });

      res.status(200).send({
        success: true,
        data: announcements,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit, 10),
        },
      });
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal server error' });
    }
  };

  return {
    createAnnouncement,
    updateAnnouncement,
    getStudentAnnouncements,
    getEducatorAnnouncements,
  };
};

module.exports = announcementController;
