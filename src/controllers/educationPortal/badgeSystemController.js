const badgeService = require('../../services/educationPortal/badgeService');

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_LEADERBOARD_SIZE = 10;
const RADIX = 10;

const badgeSystemController = function () {
  const handleError = (res, error, defaultMessage = 'An error occurred') => {
    // eslint-disable-next-line no-console
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
      const { page, limit, category, is_active: isActiveQuery } = req.query;

      const result = await badgeService.getAllBadges({
        page: parseInt(page, RADIX) || 1,
        limit: parseInt(limit, RADIX) || DEFAULT_PAGE_SIZE,
        category,
        isActive: isActiveQuery !== undefined ? isActiveQuery === 'true' : true,
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
      const { badge_id: badgeId } = req.body.badge_id ? req.body : req.query;
      
      if (!badgeId) {
        return res.status(400).json({
          success: false,
          message: 'Badge ID is required',
        });
      }

      const badge = await badgeService.getBadgeById(badgeId);

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
      const {
        name,
        description,
        image_url: imageUrl,
        category = 'achievement',
        points = 0,
        ranking = 0,
        allow_multiple: allowMultiple = false,
        criteria,
        metadata,
      } = req.body;

      const badgeData = {
        name,
        description,
        image_url: imageUrl,
        category,
        points,
        ranking,
        allow_multiple: allowMultiple,
        criteria,
        metadata,
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
      const { badge_id: badgeId } = req.body;
      
      if (!badgeId) {
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

      const updatedBadge = await badgeService.updateBadge(badgeId, updateData);

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
      const { badge_id: badgeId } = req.body;
      
      if (!badgeId) {
        return res.status(400).json({
          success: false,
          message: 'Badge ID is required',
        });
      }

      await badgeService.deleteBadge(badgeId);

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
        page: parseInt(page, RADIX) || 1,
        limit: parseInt(limit, RADIX) || DEFAULT_PAGE_SIZE,
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
      const { reason } = req.body;
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
        page: parseInt(page, RADIX) || 1,
        limit: parseInt(limit, RADIX) || DEFAULT_PAGE_SIZE,
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
      const {
        student_id: studentId,
        badge_id: badgeId,
        reason,
        metadata,
        requestor,
      } = req.body;
      const awardedBy = requestor?.requestorId;

      const awardedBadge = await badgeService.awardBadge({
        studentId,
        badgeId,
        reason: reason || 'manual_award',
        awardedBy,
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
      const {
        student_badge_id: studentBadgeId,
        revoke_reason: revokeReason,
      } = req.body;
      
      if (!studentBadgeId) {
        return res.status(400).json({
          success: false,
          message: 'Student badge ID is required',
        });
      }

      const revokedBadge = await badgeService.revokeBadge(studentBadgeId, revokeReason);

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
      const { awards, requestor } = req.body;
      const awardedBy = requestor?.requestorId;

      if (!Array.isArray(awards) || awards.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Awards must be a non-empty array',
        });
      }

      const awardsWithAuthor = awards.map(award => ({ ...award, awardedBy }));

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
        limit: parseInt(limit, RADIX) || DEFAULT_LEADERBOARD_SIZE,
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
        studentId,
        badgeId,
        reason,
        awardedBy: 'system',
        metadata,
      });
      return awardedBadge;
    } catch (error) {
      // eslint-disable-next-line no-console
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