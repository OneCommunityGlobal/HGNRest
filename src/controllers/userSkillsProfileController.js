const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../utilities/errorHandling/customError');

/**
 * Controller for user skills profile operations
 * Combines data from HgnFormResponses and UserProfile models
 *
 * @param {Object} HgnFormResponses - The HgnFormResponses model
 * @param {Object} UserProfile - The UserProfile model
 * @returns {Object} Controller methods
 */
const userSkillsProfileController = function (HgnFormResponses, UserProfile) {
  /**
   * Get comprehensive user profile with skills data
   * Respects privacy settings for contact information
   */
  const getUserSkillsProfile = async (req, res, next) => {
    try {
      // Simplified response for testing
      // return res.status(200).json({
      //   message: 'User skills profile endpoint working',
      //   requestedUserId: req.params.userId,
      //   timestamp: new Date().toISOString(),
      //   authenticated: true,
      // });

      // Original complex logic commented out for now

      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Get user profile
      let userProfile = await UserProfile.findById(userId).lean();
      let isPlaceholder = false;

      // If no profile found, use a placeholder profile for testing
      if (!userProfile) {
        console.log(`User profile with ID ${userId} not found, using placeholder data`);
        isPlaceholder = true;
        userProfile = {
          _id: userId,
          firstName: 'Test',
          lastName: 'User',
          email: 'test.user@example.com',
          phone: '555-123-4567',
          isActive: true,
          teams: [
            { name: 'Frontend Team', role: 'Developer' },
            { name: 'React Squad', role: 'Lead' },
          ],
          contactSettings: {
            isEmailPublic: true,
            isPhonePublic: false,
            preferredContact: 'email',
          },
        };
      }

      // Get latest form responses
      const formResponses = await HgnFormResponses.findOne({ user_id: userId })
        .sort({ _id: -1 })
        .lean();

      // If no form responses, create placeholder data if this is already a placeholder profile
      let hasPlaceholderSkills = false;
      let placeholderFormResponses;
      if (!formResponses && isPlaceholder) {
        hasPlaceholderSkills = true;
        placeholderFormResponses = {
          _id: new mongoose.Types.ObjectId(),
          userInfo: {
            name: `${userProfile.firstName} ${userProfile.lastName}`,
            email: userProfile.email,
            github: 'testuser',
            slack: 'testuser',
          },
          general: {
            hours: '40',
            period: 'Weekly',
            standup: 'Yes',
            location: 'Remote',
            manager: 'Yes',
            combined_frontend_backend: '4',
            mern_skills: '4',
            leadership_skills: '3',
            leadership_experience: 'Team lead for 2 years',
          },
          preferences: ['Frontend', 'React', 'Full Stack'],
          availability: {
            Monday: '9AM-5PM',
            Friday: '9AM-3PM',
          },
          frontend: {
            overall: '4',
            HTML: '5',
            Bootstrap: '4',
            CSS: '4',
            React: '5',
            Redux: '4',
            WebSocketCom: '3',
            ResponsiveUI: '4',
            UnitTest: '3',
            Documentation: '4',
            UIUXTools: '3',
          },
          backend: {
            Overall: '3',
            Database: '4',
            MongoDB: '4',
            MongoDB_Advanced: '3',
            TestDrivenDev: '3',
            Deployment: '4',
            VersionControl: '5',
            CodeReview: '4',
            EnvironmentSetup: '4',
            AdvancedCoding: '3',
            AgileDevelopment: '4',
          },
          followup: {
            platform: 'GitHub',
            other_skills: 'AWS, Docker',
            suggestion: 'More pair programming',
            additional_info: 'Available for extra projects',
          },
          user_id: userId,
        };
      }

      if (!formResponses && !isPlaceholder) {
        // Return just the user profile if no form responses exist
        return res.status(200).json({
          userProfile,
          skills: null,
          message: 'User has not completed the skills survey',
          isPlaceholder: isPlaceholder,
        });
      }

      // Use either real form responses or placeholder ones
      const skillsData = formResponses || (hasPlaceholderSkills ? placeholderFormResponses : null);

      // If we still don't have skills data, return just the profile
      if (!skillsData) {
        return res.status(200).json({
          userProfile,
          skills: null,
          message: 'User has not completed the skills survey',
          isPlaceholder: isPlaceholder,
        });
      }

      // Structure contact information with privacy control
      const contactInfo = {
        email: userProfile.email,
        phone: userProfile.phone || null,
        // Apply privacy settings if they exist
        isEmailPublic: userProfile.contactSettings?.isEmailPublic || false,
        isPhonePublic: userProfile.contactSettings?.isPhonePublic || false,
        preferredContact: userProfile.contactSettings?.preferredContact || 'email',
      };

      // Structure team information
      const teamInfo = {
        teamName: userProfile.teams?.map((team) => team.name) || [],
        slackHandle: skillsData.userInfo?.slack || null,
        githubProfile: skillsData.userInfo?.github || null,
      };

      // Structure skill information
      const skillInfo = {
        frontend: skillsData.frontend || {},
        backend: skillsData.backend || {},
        general: skillsData.general || {},
        preferences: skillsData.preferences || [],
        availability: skillsData.availability || {},
        leadershipExperience: skillsData.general?.leadership_experience || null,
        combinedSkills: skillsData.general?.combined_frontend_backend || null,
      };

      // Combine the data into a comprehensive response
      const result = {
        userId: userProfile._id,
        name: {
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          displayName:
            skillsData.userInfo?.name || `${userProfile.firstName} ${userProfile.lastName}`,
        },
        contactInfo,
        teamInfo,
        skillInfo,
        // Additional metadata
        lastUpdated: skillsData._id
          ? new Date(mongoose.Types.ObjectId(skillsData._id).getTimestamp())
          : new Date(),
        isActive: userProfile.isActive || false,
        isPlaceholder: isPlaceholder || hasPlaceholderSkills,
      };

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all team members with their skills
   * Useful for team management and project assignments
   */
  const getTeamMembersSkillsProfiles = async (req, res, next) => {
    try {
      // Simplified response for testing
      return res.status(200).json({
        message: 'Team skills profiles endpoint working',
        requestedTeam: req.params.teamName,
        timestamp: new Date().toISOString(),
        authenticated: true,
      });

      // Original complex logic commented out for now
      /*
      const { teamName } = req.params;

      if (!teamName) {
        throw new ValidationError('Team name is required');
      }

      // Find all users in the team
      const teamMembers = await UserProfile.find({
        'teams.name': { $regex: teamName, $options: 'i' },
      }).lean();

      if (!teamMembers || teamMembers.length === 0) {
        throw new NotFoundError('No team members found for this team');
      }

      // Get the user IDs
      const userIds = teamMembers.map((member) => member._id);

      // Get form responses for these users
      const formResponses = await HgnFormResponses.find({
        user_id: { $in: userIds.map((id) => id.toString()) },
      })
        .sort({ _id: -1 })
        .lean();

      // Create a map for quick lookup
      const responsesByUserId = {};
      formResponses.forEach((response) => {
        const userId = response.user_id.toString();
        if (
          !responsesByUserId[userId] ||
          (responsesByUserId[userId] &&
            new Date(mongoose.Types.ObjectId(response._id).getTimestamp()) >
              new Date(mongoose.Types.ObjectId(responsesByUserId[userId]._id).getTimestamp()))
        ) {
          responsesByUserId[userId] = response;
        }
      });

      // Combine the data
      const result = teamMembers.map((member) => {
        const userId = member._id.toString();
        const formResponse = responsesByUserId[userId] || null;

        return {
          userId: member._id,
          name: {
            firstName: member.firstName,
            lastName: member.lastName,
            displayName: formResponse?.userInfo?.name || `${member.firstName} ${member.lastName}`,
          },
          contactInfo: {
            email: member.email,
            phone: member.phone || null,
            isEmailPublic: member.contactSettings?.isEmailPublic || false,
            isPhonePublic: member.contactSettings?.isPhonePublic || false,
          },
          teamInfo: {
            teamName: member.teams?.map((team) => team.name) || [],
            slackHandle: formResponse?.userInfo?.slack || null,
            githubProfile: formResponse?.userInfo?.github || null,
          },
          skillInfo: formResponse
            ? {
                frontend: formResponse.frontend || {},
                backend: formResponse.backend || {},
                general: formResponse.general || {},
                preferences: formResponse.preferences || [],
                availability: formResponse.availability || {},
              }
            : null,
          lastUpdated: formResponse?._id
            ? new Date(mongoose.Types.ObjectId(formResponse._id).getTimestamp())
            : null,
          isActive: member.isActive || false,
          hasSkillsData: !!formResponse,
        };
      });

      return res.status(200).json(result);
      */
    } catch (error) {
      next(error);
    }
  };

  /**
   * Find users by skill criteria
   * Useful for assembling teams or finding people with specific skill sets
   */
  const findUsersBySkills = async (req, res, next) => {
    try {
      // Simplified response for testing
      return res.status(200).json({
        message: 'Find users by skills endpoint working',
        queryParams: req.query,
        timestamp: new Date().toISOString(),
        authenticated: true,
      });

      // Original complex logic commented out for now
      /*
      const { skills, minRating = '3', teamName } = req.query;

      if (!skills) {
        throw new ValidationError('Skills parameter is required');
      }

      const skillsArray = skills.split(',');

      // Build query conditions
      const skillConditions = [];

      skillsArray.forEach((skill) => {
        // Check frontend skills
        skillConditions.push({
          [`frontend.${skill}`]: { $gte: minRating },
        });

        // Check backend skills
        skillConditions.push({
          [`backend.${skill}`]: { $gte: minRating },
        });
      });

      // Find users with matching skills using aggregation
      let matchQuery = { $or: skillConditions };

      // Add team filter if provided
      if (teamName) {
        matchQuery['userInfo.slack'] = { $regex: teamName, $options: 'i' };
      }

      const matchingResponses = await HgnFormResponses.aggregate([
        {
          $match: matchQuery,
        },
        {
          $sort: { _id: -1 },
        },
        {
          $group: {
            _id: '$user_id',
            latestResponse: { $first: '$$ROOT' },
          },
        },
      ]);

      if (!matchingResponses || matchingResponses.length === 0) {
        return res.status(200).json({
          message: 'No users found with the specified skills',
          users: [],
        });
      }

      // Get the user IDs
      const userIds = matchingResponses.map((item) => item._id);

      // Get user profiles
      const userProfiles = await UserProfile.find({
        _id: { $in: userIds },
      }).lean();

      // Create a map for quick lookup
      const profileMap = {};
      userProfiles.forEach((profile) => {
        profileMap[profile._id.toString()] = profile;
      });

      // Combine the data
      const result = matchingResponses
        .map((item) => {
          const userId = item._id;
          const profile = profileMap[userId] || null;
          const response = item.latestResponse;

          if (!profile) return null;

          return {
            userId,
            name: {
              firstName: profile.firstName,
              lastName: profile.lastName,
              displayName: response.userInfo?.name || `${profile.firstName} ${profile.lastName}`,
            },
            contactInfo: {
              email: profile.contactSettings?.isEmailPublic ? profile.email : null,
              phone: profile.contactSettings?.isPhonePublic ? profile.phone : null,
            },
            skillInfo: {
              // Include only the matched skills for clarity
              matchedSkills: skillsArray.reduce((acc, skill) => {
                if (response.frontend?.[skill] && response.frontend[skill] >= minRating) {
                  acc[`frontend.${skill}`] = response.frontend[skill];
                }
                if (response.backend?.[skill] && response.backend[skill] >= minRating) {
                  acc[`backend.${skill}`] = response.backend[skill];
                }
                return acc;
              }, {}),
              teamName: profile.teams?.map((team) => team.name) || [],
              availability: response.availability || {},
            },
          };
        })
        .filter(Boolean); // Remove null entries

      return res.status(200).json({
        count: result.length,
        users: result,
      });
      */
    } catch (error) {
      next(error);
    }
  };

  return {
    getUserSkillsProfile,
    getTeamMembersSkillsProfiles,
    findUsersBySkills,
  };
};

module.exports = userSkillsProfileController;
