const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const HGNFormResponses = require('../models/hgnFormResponse');

const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

// Determines help request eligibility using server-side user profile
// and questionnaire data.
const getHelpRequestEligibility = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return { eligible: false, questionnaireCompleted: false };
  }

  const userObjectId = mongoose.Types.ObjectId(String(userId));

  const [profile, formResponse] = await Promise.all([
    UserProfile.findById(userObjectId, 'role').lean(),
    HGNFormResponses.findOne({
      $or: [{ user_id: userObjectId }, { user_id: String(userId) }],
    }).lean(),
  ]);

  const questionnaireCompleted = Boolean(formResponse);

  if (!profile) {
    return { eligible: false, questionnaireCompleted };
  }

  const role = normalize(profile.role);

  const hasDefaultAccess = ['owner', 'administrator', 'core team'].includes(role);

  return {
    eligible: hasDefaultAccess || questionnaireCompleted,
    questionnaireCompleted,
  };
};

module.exports = { getHelpRequestEligibility };
