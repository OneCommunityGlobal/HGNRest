const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const HGNFormResponses = require('../models/hgnFormResponse');

const SOFTWARE_DEV_TEAM_MATCH = 'software development team';

const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

// Authoritative, server-side computation of HGN Help request eligibility.
// Never trust a client-supplied role/team/isActive/questionnaire value for this check.
const getHelpRequestEligibility = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return { eligible: false, questionnaireCompleted: false };
  }

  const userObjectId = mongoose.Types.ObjectId(String(userId));

  const [profile, formResponse] = await Promise.all([
    UserProfile.findById(userObjectId, 'role isActive teams')
      .populate({ path: 'teams', select: 'teamName' })
      .lean(),
    HGNFormResponses.findOne({
      $or: [{ user_id: userObjectId }, { user_id: String(userId) }],
    }).lean(),
  ]);

  const questionnaireCompleted = Boolean(formResponse);

  if (!profile) {
    return { eligible: false, questionnaireCompleted };
  }

  const role = normalize(profile.role);
  const isCoreTeam = role === 'core team';
  const isAdministrator = role === 'administrator';
  const isOwner = role === 'owner';

  const teams = Array.isArray(profile.teams) ? profile.teams : [];
  // "Active SD" is a strict subset of SD membership here (SD members are eligible regardless of
  // isActive), so it does not need its own branch to satisfy the confirmed business rule.
  const isSoftwareDevelopmentMember = teams.some((team) =>
    normalize(team?.teamName).includes(SOFTWARE_DEV_TEAM_MATCH),
  );

  const belongsToAllowedGroup =
    isCoreTeam || isAdministrator || isOwner || isSoftwareDevelopmentMember;

  return {
    eligible: questionnaireCompleted && belongsToAllowedGroup,
    questionnaireCompleted,
  };
};

module.exports = { getHelpRequestEligibility };
