const mongoose = require('mongoose');
const { ValidationError } = require('../utilities/errorHandling/customError');

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
      const { userId } = req.params;

      // Validate user ID format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Get user profile - use default values if not found
      const userProfile = (await UserProfile.findById(userId).lean()) || {
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

      // Get skills data - use default values if not found
      const formResponses = await HgnFormResponses.findOne({ user_id: userId })
        .sort({ _id: -1 })
        .lean();

      // Flag if we're using real or placeholder data
      const isProfilePlaceholder = !(await UserProfile.findById(userId));
      const isSkillsPlaceholder = !formResponses;

      // Build contact information, respecting privacy settings
      const contactInfo = {
        email: userProfile.contactSettings?.isEmailPublic ? userProfile.email : null,
        phone: userProfile.contactSettings?.isPhonePublic ? userProfile.phone || null : null,
        preferredContact: userProfile.contactSettings?.preferredContact || 'email',
      };

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

        // Separate team info from social handles
        teamInfo: {
          teamName: userProfile.teams?.map((team) => team._id) || [],
          // Add any other team-specific info here if needed
        },

        // New field for social handles
        socialHandles: {
          slack: formResponses?.userInfo?.slack || 'Not provided',
          github: formResponses?.userInfo?.github || 'Not provided',
          // Add any other social handles that might be available
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

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  return {
    getUserSkillsProfile,
  };
};

module.exports = userSkillsProfileController;
