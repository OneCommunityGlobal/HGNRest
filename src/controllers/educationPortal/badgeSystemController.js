const badgeService = require('../../services/educationPortal/badgeService');

const badgeSystemController = function () {
  const handleError = (res, error, defaultMessage = 'An error occurred') => {
    console.error('Badge Controller Error:', error);
    const statusCode = error.statusCode || (error.message.includes('not found') ? 404 : 500);
    
    res.status(statusCode).json({
      success: false,
      message: error.message || defaultMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  };

  const getAllBadges = async (req, res) => {
    try {
      const { page, limit, category, is_active } = req.query;

      const result = await badgeService.getAllBadges({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        category,
        is_active: is_active !== undefined ? is_active === 'true' : true,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      handleError(res, error, 'Error fetching badges');
    }
  };

  const getBadgeById = async (req, res) => {
    try {
      const badge_id = req.body.badge_id || req.query.badge_id;
      
      if (!badge_id) {
        return res.status(400).json({
          success: false,
          message: 'Badge ID is required',
        });
      }

      const badge = await badgeService.getBadgeById(badge_id);

      if (!badge) {
        return res.status(404).json({
          success: false,
          message: 'Badge not found',
        });
      }

      res.status(200).json({
        success: true,
        data: badge,
      });
    } catch (error) {
      handleError(res, error, 'Error fetching badge');
    }
  };

  const createBadge = async (req, res) => {
    try {
      const badgeData = {
        name: req.body.name,
        description: req.body.description,
        image_url: req.body.image_url,
        category: req.body.category || 'achievement',
        points: req.body.points || 0,
        ranking: req.body.ranking || 0,
        allow_multiple: req.body.allow_multiple || false,
        criteria: req.body.criteria,
        metadata: req.body.metadata,
      };

      const newBadge = await badgeService.createBadge(badgeData);

      res.status(201).json({
        success: true,
        message: 'Badge created successfully',
        data: newBadge,
      });
    } catch (error) {
      handleError(res, error, 'Error creating badge');
    }
  };

  const updateBadge = async (req, res) => {
    try {
      const badge_id = req.body.badge_id;
      
      if (!badge_id) {
        return res.status(400).json({
          success: false,
          message: 'Badge ID is required',
        });
      }

      const updateData = {};
      const allowedFields = [
        'name',
        'description',
        'image_url',
        'category',
        'is_active',
        'points',
        'ranking',
        'allow_multiple',
        'criteria',
        'metadata',
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      const updatedBadge = await badgeService.updateBadge(badge_id, updateData);

      res.status(200).json({
        success: true,
        message: 'Badge updated successfully',
        data: updatedBadge,
      });
    } catch (error) {
      handleError(res, error, 'Error updating badge');
    }
  };

  const deleteBadge = async (req, res) => {
    try {
      const badge_id = req.body.badge_id;
      
      if (!badge_id) {
        return res.status(400).json({
          success: false,
          message: 'Badge ID is required',
        });
      }

      await badgeService.deleteBadge(badge_id);

      res.status(200).json({
        success: true,
        message: 'Badge deleted successfully',
      });
    } catch (error) {
      handleError(res, error, 'Error deleting badge');
    }
  };

  const getStudentBadges = async (req, res) => {
    try {
      const studentId = req.headers.userid || req.headers.userId;
      
      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required in headers (userId)',
        });
      }

      const { page, limit } = req.query;

      const result = await badgeService.getStudentBadges(studentId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      handleError(res, error, 'Error fetching student badges');
    }
  };

  const getStudentBadgesByReason = async (req, res) => {
    try {
      const reason = req.body.reason;
      const studentId = req.headers.userid || req.headers.userId;
      
      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required in headers (userId)',
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Reason is required in request body',
        });
      }

      const { page, limit } = req.query;

      const result = await badgeService.getStudentBadges(studentId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        reason,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      handleError(res, error, 'Error fetching badges by reason');
    }
  };

  const awardBadge = async (req, res) => {
    try {
      
      const { student_id, badge_id, reason, metadata } = req.body;
      const awarded_by = req.body.requestor?.requestorId;

      const awardedBadge = await badgeService.awardBadge({
        student_id,
        badge_id,
        reason: reason || 'manual_award',
        awarded_by,
        metadata,
      });

      res.status(201).json({
        success: true,
        message: 'Badge awarded successfully',
        data: awardedBadge,
      });
    } catch (error) {
      handleError(res, error, 'Error awarding badge');
    }
  };

  const revokeBadge = async (req, res) => {
    try {
      const student_badge_id = req.body.student_badge_id;
      const revoke_reason = req.body.revoke_reason;
      
      if (!student_badge_id) {
        return res.status(400).json({
          success: false,
          message: 'Student badge ID is required',
        });
      }

      const revokedBadge = await badgeService.revokeBadge(student_badge_id, revoke_reason);

      res.status(200).json({
        success: true,
        message: 'Badge revoked successfully',
        data: revokedBadge,
      });
    } catch (error) {
      handleError(res, error, 'Error revoking badge');
    }
  };

  const getStudentBadgeStats = async (req, res) => {
    try {
      const studentId = req.headers.userid || req.headers.userId;
      
      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required in headers (userId)',
        });
      }

      const stats = await badgeService.getStudentBadgeStats(studentId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      handleError(res, error, 'Error fetching badge statistics');
    }
  };

  const bulkAwardBadges = async (req, res) => {
    try {
      const { awards } = req.body;
      const awarded_by = req.body.requestor?.requestorId;

      if (!Array.isArray(awards) || awards.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Awards must be a non-empty array',
        });
      }

      const awardsWithAuthor = awards.map(award => ({ ...award, awarded_by }));

      const results = await badgeService.bulkAwardBadges(awardsWithAuthor);

      res.status(200).json({
        success: true,
        message: 'Bulk badge award completed',
        data: results,
      });
    } catch (error) {
      handleError(res, error, 'Error in bulk badge award');
    }
  };

  const getBadgeLeaderboard = async (req, res) => {
    try {
      const { limit, category } = req.query;

      const leaderboard = await badgeService.getBadgeLeaderboard({
        limit: parseInt(limit) || 10,
        category,
      });

      res.status(200).json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      handleError(res, error, 'Error fetching badge leaderboard');
    }
  };

  const awardBadgeAutomatically = async (studentId, badgeId, reason, metadata = {}) => {
    try {
      const awardedBadge = await badgeService.awardBadge({
        student_id: studentId,
        badge_id: badgeId,
        reason,
        awarded_by: 'system',
        metadata,
      });
      return awardedBadge;
    } catch (error) {
      console.error('Error awarding badge automatically:', error);
      return null;
    }
  };

  return {
    getAllBadges,
    getBadgeById,
    createBadge,
    updateBadge,
    deleteBadge,
    getStudentBadges,
    getStudentBadgesByReason,
    awardBadge,
    revokeBadge,
    getStudentBadgeStats,
    bulkAwardBadges,
    getBadgeLeaderboard,
    awardBadgeAutomatically,
  };
};

module.exports = badgeSystemController();