const ApplicationAccess = require('../models/applicationAccess');
const UserProfile = require('../models/userProfile');

// The permanent questionnaire link only opens for people who were set up and
// invited through the HGN Dropbox process (Access Management > Dropbox > Invite).
// That process records an applicationAccess entry with app 'dropbox' and status 'invited'.
const QUESTIONNAIRE_ACCESS_APP = 'dropbox';
const QUESTIONNAIRE_ACCESS_STATUS = 'invited';

// Owners can always open the questionnaire to preview it.
const BYPASS_ROLES = ['Owner'];

const REASONS = {
  NOT_LOGGED_IN: 'NOT_LOGGED_IN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INACTIVE: 'INACTIVE',
  NOT_INVITED: 'NOT_INVITED',
  ACCESS_REVOKED: 'ACCESS_REVOKED',
};

async function getQuestionnaireAccess(requestor) {
  if (!requestor?.requestorId) {
    return { eligible: false, reason: REASONS.NOT_LOGGED_IN };
  }

  if (BYPASS_ROLES.includes(requestor.role)) {
    return { eligible: true, reason: null };
  }

  const user = await UserProfile.findById(requestor.requestorId, 'isActive').lean();
  if (!user) {
    return { eligible: false, reason: REASONS.USER_NOT_FOUND };
  }
  if (!user.isActive) {
    return { eligible: false, reason: REASONS.INACTIVE };
  }

  const appAccess = await ApplicationAccess.findOne({
    userId: String(requestor.requestorId),
  }).lean();
  const dropbox = appAccess?.apps?.find((a) => a.app === QUESTIONNAIRE_ACCESS_APP);

  if (!dropbox) {
    return { eligible: false, reason: REASONS.NOT_INVITED };
  }
  if (dropbox.status !== QUESTIONNAIRE_ACCESS_STATUS) {
    return { eligible: false, reason: REASONS.ACCESS_REVOKED };
  }

  return { eligible: true, reason: null, invitedOn: dropbox.invitedOn };
}

module.exports = { getQuestionnaireAccess, REASONS };
