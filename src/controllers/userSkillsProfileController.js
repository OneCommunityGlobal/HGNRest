const mongoose = require('mongoose');
const { ValidationError } = require('../utilities/errorHandling/customError');
const { hasPermission } = require('../utilities/permissions');
const Logger = require('../startup/logger');

/**
 * Controller for user skills profile operations
 *
 * @param {Object} HgnFormResponses - The HgnFormResponses model
 * @param {Object} UserProfile - The UserProfile model
 * @returns {Object} Controller methods
 */
const userSkillsProfileController = function (HgnFormResponses, UserProfile) {
  /**
   * Get user profile with skills data
   * Returns consistent structure regardless of data availability
   */
  const getUserSkillsProfile = async (req, res, next) => {
    try {
      // Check if user has permission to view user profiles
      const hasAccess = await hasPermission(req.body.requestor, 'getUserProfiles');

      // Log access attempt for tracking
      Logger.logInfo(`User skills profile access attempt`, {
        requestorId: req.body.requestor.requestorId,
        targetUserId: req.params.userId,
        hasAccess,
        timestamp: new Date().toISOString(),
      });

      // If not authorized and trying to view someone else's profile
      if (!hasAccess && req.body.requestor.requestorId !== req.params.userId) {
        Logger.logInfo(`Unauthorized access attempt to user skills profile`, {
          requestorId: req.body.requestor.requestorId,
          targetUserId: req.params.userId,
          timestamp: new Date().toISOString(),
        });
        return res
          .status(403)
          .json({ error: 'You do not have permission to view this user profile' });
      }

      const { userId } = req.params;

      // Validate user ID format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Get user profile with populated teams - only retrieve needed fields
      let userProfile = await UserProfile.findById(userId)
        .populate({
          path: 'teams',
          select: '_id teamName role',
        })
        .lean();

      // Use default values if not found
      if (!userProfile) {
        userProfile = {
          _id: userId,
          firstName: 'Unknown',
          lastName: 'User',
          email: 'unknown@example.com',
          isActive: false,
          teams: [],
          jobTitle: [],
          contactSettings: {
            isEmailPublic: false,
            isPhonePublic: false,
            preferredContact: 'email',
          },
        };

        // Log when using placeholder data
        Logger.logInfo(`Using placeholder data for user profile`, {
          requestorId: req.body.requestor.requestorId,
          targetUserId: userId,
          timestamp: new Date().toISOString(),
        });
      }

      // Get skills data - use default values if not found
      const userIdObj = mongoose.Types.ObjectId(userId);
      const formResponses = await HgnFormResponses.findOne({ user_id: userIdObj })
        .sort({ _id: -1 })
        .lean();

      // Flag if we're using real or placeholder data
      const isProfilePlaceholder = !(await UserProfile.findById(userId));
      const isSkillsPlaceholder = !formResponses;

      if (isSkillsPlaceholder) {
        // Log when using placeholder skills data
        Logger.logInfo(`Using placeholder skills data`, {
          requestorId: req.body.requestor.requestorId,
          targetUserId: userId,
          timestamp: new Date().toISOString(),
        });
      }

      // Build contact information, respecting privacy settings
      const contactInfo = {
        email: userProfile.contactSettings?.isEmailPublic ? userProfile.email : null,
        phone: userProfile.contactSettings?.isPhonePublic ? userProfile.phone || null : null,
        public:
          userProfile.contactSettings?.isEmailPublic ||
          userProfile.contactSettings?.isPhonePublic ||
          false,
      };

      // Extract team details - handle both populated and non-populated teams
      const teamDetails =
        userProfile.teams?.map((team) => {
          // Check if team is directly populated or is just an ID reference
          if (typeof team === 'object' && team._id) {
            return {
              id: team._id,
              name: team.teamName || 'Unknown Team',
              role: team.role || 'Member',
            };
          }
          // Fallback if population didn't work (or using default values)
          return {
            id: team || 'unknown',
            name: 'Unknown Team',
            role: 'Member',
          };
        }) || [];

      // Build response with available data or placeholders
      const result = {
        userId: userProfile._id,
        name: {
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          displayName:
            formResponses?.userInfo?.name || `${userProfile.firstName} ${userProfile.lastName}`,
        },
        contactInfo,
        jobTitle: userProfile.jobTitle || [],

        // Use the extracted team details

        teams: teamDetails,

        // Social handles
        socialHandles: {
          slack: formResponses?.userInfo?.slack || 'Not provided',
          github: formResponses?.userInfo?.github || 'Not provided',
        },

        skillInfo: {
          frontend: formResponses?.frontend || {
            overall: '0',
            note: 'No frontend skills data available',
          },
          backend: formResponses?.backend || {
            Overall: '0',
            note: 'No backend skills data available',
          },
          general: formResponses?.general || {
            hours: 'N/A',
            period: 'N/A',
            leadership_experience: 'No data available',
            combined_frontend_backend: '0',
          },
          followup: formResponses?.followup || {
            platform: 'N/A',
            other_skills: 'N/A',
            suggestion: 'N/A',
            additional_info: 'No followup data available',
          },
          preferences: formResponses?.preferences || ['No preferences data available'],
          availability: formResponses?.availability || { Note: 'No availability data provided' },
          leadershipExperience:
            formResponses?.general?.leadership_experience || 'No data available',
          combinedSkills: formResponses?.general?.combined_frontend_backend || '0',
        },
        lastUpdated: formResponses?._id
          ? new Date(mongoose.Types.ObjectId(formResponses._id).getTimestamp())
          : new Date(),
        isActive: userProfile.isActive || false,
        isPlaceholder: isProfilePlaceholder || isSkillsPlaceholder,
      };

      // Log successful profile retrieval
      Logger.logInfo(`User skills profile successfully retrieved`, {
        requestorId: req.body.requestor.requestorId,
        targetUserId: userId,
        isProfilePlaceholder,
        isSkillsPlaceholder,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json(result);
    } catch (error) {
      // Log exceptions with transaction name and relevant data
      Logger.logException(error, 'getUserSkillsProfile', {
        requestorId: req.body.requestor?.requestorId,
        targetUserId: req.params?.userId,
        timestamp: new Date().toISOString(),
      });
      next(error);
    }
  };

  return {
    getUserSkillsProfile,
  };
};

module.exports = userSkillsProfileController;
