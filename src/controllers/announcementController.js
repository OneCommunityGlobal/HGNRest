const Announcement = require('../models/announcements');
const LOGGER = require('../startup/logger');

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
    if (!['Administrator', 'Owner', 'Teacher', 'Program Manager'].includes(requestor.role)) {
      res.status(403).send({ error: 'Unauthorized: Only educators can create announcements' });
      return;
    }

    // Validate required fields
    if (!title || !body) {
      res.status(400).send({ error: 'Title and body are required' });
      return;
    }

    // Validate audience if provided
    const validAudiences = ['students', 'educators', 'support'];
    if (audience && !validAudiences.includes(audience)) {
      res
        .status(400)
        .send({ error: 'Invalid audience type. Must be one of: students, educators, support' });
      return;
    }

    try {
      // Get the next announcement_id
      const lastAnnouncement = await Announcement.findOne().sort({ announcement_id: -1 });
      const nextAnnouncementId = lastAnnouncement ? lastAnnouncement.announcement_id + 1 : 1;

      const announcement = new Announcement({
        announcement_id: nextAnnouncementId,
        user_id: requestor.requestorId,
        title: title.trim(),
        body: body.trim(),
        audience: audience || 'students',
      });

      const savedAnnouncement = await announcement.save();

      // Populate creator info
      await savedAnnouncement.populate('creatorInfo');

      res.status(201).send({
        success: true,
        message: 'Announcement created successfully',
        data: savedAnnouncement,
      });
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal server error' });
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

    // Temporarily commented out for testing - allows any user to access student announcements
    // if (requestor.role !== 'Student') {
    //   res.status(403).send({ error: 'Unauthorized: This endpoint is for students only' });
    //   return;
    // }

    try {
      const skip = (page - 1) * limit;

      // Get announcements that are relevant to students
      const announcements = await Announcement.find({
        audience: { $in: ['students', 'support'] },
      })
        .populate('creatorInfo', 'firstName lastName email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10));

      const total = await Announcement.countDocuments({
        audience: { $in: ['students', 'support'] },
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
    getStudentAnnouncements,
    getEducatorAnnouncements,
  };
};

module.exports = announcementController;
