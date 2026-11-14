const ApplicationAccess = require('../models/applicationAccess');
const UserProfile = require('../models/userProfile');
const dropboxService = require('../services/automation/dropboxService');

// The permanent questionnaire link only opens for people who were set up and
// invited through the Highest Good Network Dropbox (Access Management > Dropbox >
// "Highest Good Network Team" folder > Invite). Invites into any other team folder,
// such as the Administration Team folder, do not unlock the questionnaire.
const QUESTIONNAIRE_ACCESS_APP = 'dropbox';
const QUESTIONNAIRE_ACCESS_STATUS = 'invited';
const QUESTIONNAIRE_TEAM_FOLDER_KEY = 'HGN';

// Owners can always open the questionnaire to preview it.
const BYPASS_ROLES = ['Owner'];

const REASONS = {
  NOT_LOGGED_IN: 'NOT_LOGGED_IN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INACTIVE: 'INACTIVE',
  NOT_INVITED: 'NOT_INVITED',
  ACCESS_REVOKED: 'ACCESS_REVOKED',
  NOT_HGN_TEAM_FOLDER: 'NOT_HGN_TEAM_FOLDER',
};

// Invites made before the team folder was recorded have no teamFolderKey.
// Look it up from Dropbox once and store it so later checks stay local.
async function resolveTeamFolderKey(userId, dropbox) {
  if (dropbox.teamFolderKey) return dropbox.teamFolderKey;
  if (!dropbox.credentials) return null;

  const teamFolderKey = await dropboxService.getTeamFolderKeyForFolder(dropbox.credentials);
  if (teamFolderKey) {
    await ApplicationAccess.updateOne(
      { userId, 'apps.app': QUESTIONNAIRE_ACCESS_APP },
      { $set: { 'apps.$.teamFolderKey': teamFolderKey } },
    );
  }
  return teamFolderKey;
}

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

  const userId = String(requestor.requestorId);
  const appAccess = await ApplicationAccess.findOne({ userId }).lean();
  const dropbox = appAccess?.apps?.find((a) => a.app === QUESTIONNAIRE_ACCESS_APP);

  if (!dropbox) {
    return { eligible: false, reason: REASONS.NOT_INVITED };
  }
  if (dropbox.status !== QUESTIONNAIRE_ACCESS_STATUS) {
    return { eligible: false, reason: REASONS.ACCESS_REVOKED };
  }

  const teamFolderKey = await resolveTeamFolderKey(userId, dropbox);
  if (teamFolderKey !== QUESTIONNAIRE_TEAM_FOLDER_KEY) {
    return { eligible: false, reason: REASONS.NOT_HGN_TEAM_FOLDER };
  }

  return { eligible: true, reason: null, invitedOn: dropbox.invitedOn };
}

module.exports = { getQuestionnaireAccess, REASONS, QUESTIONNAIRE_TEAM_FOLDER_KEY };
