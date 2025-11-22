const epBadge = require('../../models/educationPortal/epBadgeModel');
const studentBadges = require('../../models/educationPortal/studentBadgesModel');

const badgeSystemController = function () {
  const handleError = (res, statusCode, message, error) => {
    res.status(statusCode).json({
      success: false,
      message,
      error: error?.message || error,
    });
  };

  const getStudentBadges = async (req, res) => {
    try {
      const studentId = req.user._id;
      const badges = await studentBadges
        .find({ student_id: studentId, is_revoked: false })
        .populate('badge_id', 'name description image_url category')
        .populate('awarded_by', 'firstname lastname')
        .sort({ awarded_at: -1 });

      res.status(200).json({ success: true, data: badges });
    } catch (error) {
      handleError(res, 500, 'Error fetching student badges', error);
    }
  };

  const awardBadge = async (req, res) => {
    try {
      const { student_id, badge_id, reason } = req.body;
      const awarded_by = req.user._id;

      const badge = await epBadge.findById(badge_id);
      if (!badge) {
        return handleError(res, 404, 'Badge not found');
      }

      const existingBadge = await studentBadges.findOne({
        student_id,
        badge_id,
        is_revoked: false,
      });

      if (existingBadge) {
        return handleError(res, 400, 'Student already has this badge');
      }

      const newBadge = new studentBadges({
        student_id,
        badge_id,
        reason: reason || 'manual_award',
        awarded_by,
      });

      await newBadge.save();
      await newBadge.populate('badge_id', 'name description image_url category');
      await newBadge.populate('awarded_by', 'firstname lastname');

      res.status(201).json({
        success: true,
        message: 'Badge awarded successfully',
        data: newBadge,
      });
    } catch (error) {
      handleError(res, 500, 'Error awarding badge', error);
    }
  };

  const revokeBadge = async (req, res) => {
    try {
      const { student_badge_id } = req.params;

      const badge = await studentBadges.findByIdAndUpdate(
        student_badge_id,
        { is_revoked: true, revoked_at: new Date() },
        { new: true }
      );

      if (!badge) {
        return handleError(res, 404, 'Badge not found');
      }

      res.status(200).json({
        success: true,
        message: 'Badge revoked successfully',
        data: badge,
      });
    } catch (error) {
      handleError(res, 500, 'Error revoking badge', error);
    }
  };

  const createBadge = async (req, res) => {
    try {
      const { name, description, image_url, category } = req.body;

      // Validate required fields
      if (!name || !description || !image_url) {
        return handleError(res, 400, 'Name, description, and image_url are required');
      }

      const newBadge = new epBadge({
        name,
        description,
        image_url,
        category: category || 'achievement',
        is_active: true,
      });

      await newBadge.save();

      res.status(201).json({
        success: true,
        message: 'Badge created successfully',
        data: newBadge,
      });
    } catch (error) {
      handleError(res, 500, 'Error creating badge', error);
    }
  };

  const getAllBadges = async (req, res) => {
    try {
      const badges = await epBadge.find({ is_active: true }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: badges });
    } catch (error) {
      handleError(res, 500, 'Error fetching badges', error);
    }
  };

  const updateBadge = async (req, res) => {
    try {
      const { badge_id } = req.params;
      const { name, description, image_url, category, is_active } = req.body;

      const badge = await epBadge.findByIdAndUpdate(
        badge_id,
        { name, description, image_url, category, is_active },
        { new: true, runValidators: true }
      );

      if (!badge) {
        return handleError(res, 404, 'Badge not found');
      }

      res.status(200).json({
        success: true,
        message: 'Badge updated successfully',
        data: badge,
      });
    } catch (error) {
      handleError(res, 500, 'Error updating badge', error);
    }
  };

  const getStudentBadgesByReason = async (req, res) => {
    try {
      const { reason } = req.params;
      const studentId = req.user._id;

      const badges = await studentBadges
        .find({ student_id: studentId, reason, is_revoked: false })
        .populate('badge_id', 'name description image_url category')
        .populate('awarded_by', 'firstname lastname')
        .sort({ awarded_at: -1 });

      res.status(200).json({ success: true, data: badges });
    } catch (error) {
      handleError(res, 500, 'Error fetching badges by reason', error);
    }
  };

  const awardBadgeAutomatically = async (studentId, badgeId, reason) => {
    try {
      const existingBadge = await studentBadges.findOne({
        student_id: studentId,
        badge_id: badgeId,
        is_revoked: false,
      });

      if (existingBadge) return null;

      const newBadge = new studentBadges({
        student_id: studentId,
        badge_id: badgeId,
        reason,
      });

      await newBadge.save();
      return newBadge;
    } catch (error) {
      console.error('Error awarding badge automatically:', error);
      return null;
    }
  };

  return {
    getStudentBadges,
    awardBadge,
    revokeBadge,
    createBadge,
    getAllBadges,
    updateBadge,
    getStudentBadgesByReason,
    awardBadgeAutomatically,
  };
};

module.exports = badgeSystemController();