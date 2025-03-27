const Role = require('../models/role');
const RolePreset = require('../models/rolePreset');

const permissionsRoles = [
  {
    roleName: 'Administrator',
    permissions: [
      // Reports
      'getWeeklySummaries',
      'getReports', // Doesn't do anything on back-end.
      'totalValidWeeklySummaries',
      // Badges
      'seeBadges',
      'assignBadges',
      'createBadges',
      'deleteBadges',
      'updateBadges',
      // Popups
      'createPopup',
      'updatePopup',
      // Projects
      'deleteProject',
      'postProject',
      'putProject',
      'assignProjectToUsers',
      // Tasks
      'importTask',
      'postTask',
      'updateTask',
      'swapTask',
      'deleteTask',
      'updateNum',
      // Teams
      'postTeam',
      'deleteTeam',
      'putTeam',
      'assignTeamToUsers',
      // Time Entries
      'editTimeEntryTime',
      'editTimeEntryDate',
      'editTimeEntryDescription',
      'editTimeEntryToggleTangible',
      'deleteTimeEntry',
      'postTimeEntry',
      // User Profile
      'putRole',
      'postUserProfile',
      'putUserProfile',
      'putUserProfileImportantInfo',
      'updateSummaryRequirements',
      'changeUserStatus',
      'updatePassword',
      'deleteUserProfile',
      'addInfringements',
      'editInfringements',
      'deleteInfringements',
      // WBS
      'postWbs',
      'deleteWbs',
      // Inv
      'getAllInvInProjectWBS',
      'postInvInProjectWBS',
      'getAllInvInProject',
      'postInvInProject',
      'transferInvById',
      'delInvById',
      'unWasteInvById',
      'getInvIdInfo',
      'putInvById',
      'getInvTypeById',
      'putInvType',
      'getAllInvType',
      'postInvType',
      // General
      'getUserProfiles',
      'getProjectMembers',

      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Volunteer',
    permissions: ['getReporteesLimitRoles', 'suggestTask'],
  },
  {
    roleName: 'Core Team',
    permissions: [
      'getUserProfiles',
      'getProjectMembers',
      'getAllInvInProjectWBS',
      'postInvInProjectWBS',
      'getAllInvInProject',
      'postInvInProject',
      'transferInvById',
      'delInvById',
      'unWasteInvById',
      'getInvIdInfo',
      'putInvById',
      'getInvTypeById',
      'putInvType',
      'getAllInvType',
      'postInvType',
      'getWeeklySummaries',
      'getReports',
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Manager',
    permissions: [
      'getUserProfiles',
      'getProjectMembers',
      'putUserProfile',
      'addInfringements',
      'editInfringements',
      'deleteInfringements',
      'getReporteesLimitRoles',
      'updateTask',
      'putTeam',
      'getAllInvInProjectWBS',
      'postInvInProjectWBS',
      'getAllInvInProject',
      'postInvInProject',
      'transferInvById',
      'delInvById',
      'unWasteInvById',
      'getInvIdInfo',
      'putInvById',
      'getInvTypeById',
      'putInvType',
      'getAllInvType',
      'postInvType',
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Mentor',
    permissions: [
      'suggestTask',
      'getUserProfiles',
      'getProjectMembers',
      'putUserProfile',
      'addInfringements',
      'editInfringements',
      'deleteInfringements',
      'getReporteesLimitRoles',
      'getAllInvInProjectWBS',
      'postInvInProjectWBS',
      'getAllInvInProject',
      'postInvInProject',
      'transferInvById',
      'delInvById',
      'unWasteInvById',
      'getInvIdInfo',
      'putInvById',
      'getInvTypeById',
      'putInvType',
      'getAllInvType',
      'postInvType',
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Owner',
    permissions: [
      'postRole',
      'deleteRole',
      'putRole',
      'addDeleteEditOwners',
      'putUserProfilePermissions',
      'changeUserStatus',
      'seeBadges',
      'assignBadges',
      'createBadges',
      'deleteBadges',
      'updateBadges',
      'createPopup',
      'updatePopup',
      'deleteProject',
      'postProject',
      'putProject',
      'assignProjectToUsers',
      'importTask',
      'postTask',
      'updateNum',
      'updateTask',
      'swapTask',
      'deleteTask',
      'postTeam',
      'deleteTeam',
      'putTeam',
      'assignTeamToUsers',
      'editTimeEntryTime',
      'editTimeEntryDescription',
      'editTimeEntryDate',
      'editTimeEntryToggleTangible',
      'deleteTimeEntry',
      'postTimeEntry',
      'sendEmails',
      'sendEmailToAll',
      'updatePassword',
      'resetPassword',
      'getUserProfiles',
      'getProjectMembers',
      'postUserProfile',
      'putUserProfile',
      'putUserProfileImportantInfo',
      'updateSummaryRequirements',
      'deleteUserProfile',
      'addInfringements',
      'editInfringements',
      'deleteInfringements',
      'postWbs',
      'deleteWbs',
      'getAllInvInProjectWBS',
      'postInvInProjectWBS',
      'getAllInvInProject',
      'postInvInProject',
      'transferInvById',
      'delInvById',
      'unWasteInvById',
      'getInvIdInfo',
      'putInvById',
      'getInvTypeById',
      'putInvType',
      'getAllInvType',
      'postInvType',
      'getWeeklySummaries',
      'getReports',
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
      'editTeamCode',
      'totalValidWeeklySummaries',
    ],
  },
];

const createInitialPermissions = async () => {
  const promises = [];
  // Add a new permission if the role has been changed in the  permissionsRoles Array
  for (let i = 0; i < permissionsRoles.length; i += 1) {
    const { roleName, permissions } = permissionsRoles[i];

    // Create Roles
    const role = new Role();
    role.roleName = roleName;
    role.permissions = permissions;
    promises.push(role.save());

    // Create Default presets

    const defaultPreset = new RolePreset();
    defaultPreset.roleName = roleName;
    defaultPreset.presetName = 'default';
    defaultPreset.permissions = permissions;
    promises.push(defaultPreset.save());
  }

  await Promise.all(promises);
};
module.exports = createInitialPermissions;
