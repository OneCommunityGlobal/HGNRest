const Role = require('../models/role');
const User = require('../models/userProfile');

const permissionsRoles = [
  {
    roleName: 'Administrator',
    permissions: [
      'seeWeeklySummaryReports',
      'seeUserManagement',
      'seeSummaryManagement',
      'seeBadgeManagement',
      'seePopupManagement',
      'seeProjectManagement',
      'seeTeamsManagement',
      'deleteOwnBadge',
      'modifyOwnBadgeAmount',
      'assignBadgeOthers',
      'editTimelogInfo',
      'addTimeEntryOthers',
      'deleteTimeEntryOthers',
      'toggleTangibleTime',
      'changeIntangibleTimeEntryDate',
      'editTimeEntry',
      'deleteTimeEntry',
      'deleteWbs',
      'addTask',
      'deleteTask',
      'editTask',
      'addWbs',
      'addProject',
      'deleteProject',
      'editProject',
      'findUserInProject',
      'assignUserInProject',
      'unassignUserInProject',
      'adminLinks',
      'editUserProfile',
      'assignTeamToUser',
      'seeUserProfileInProjects',
      'createTeam',
      'editDeleteTeam',
      'handleBlueSquare',
      'resetPasswordOthers',
      'dataIsTangibleTimelog',
      'toggleSubmitForm',
      'seePermissionsManagement',
      'changeBioAnnouncement',
      'changeUserStatus',
      'submitWeeklySummaryForOthers',
      'seeAllReports',
      'removeUserFromTask',
    ],
    permissionsBackEnd: [
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
      'deleteTeam',
      'putTeam',
      'assignTeamToUsers',
      'editTimeEntry',
      'deleteTimeEntry',
      'updatePassword',
      'getUserProfiles',
      'getProjectMembers',
      'postUserProfile',
      'putUserProfile',
      'putUserProfileImportantInfo',
      'infringementAuthorizer',
      'deleteUserProfile',
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
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Volunteer',
    permissions: ['V'],
    permissionsBackEnd: ['getReporteesLimitRoles'],
  },
  {
    roleName: 'Core Team',
    permissions: ['seeWeeklySummaryReports'],
    permissionsBackEnd: [
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
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Manager',
    permissions: [
      'seeWeeklySummaryReports',
      'assignOnlyBlueSquares',
      'suggestTask',
    ],
    permissionsBackEnd: [
      'getUserProfiles',
      'getProjectMembers',
      'putUserProfile',
      'infringementAuthorizer',
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
      'getWeeklySummaries',
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Mentor',
    permissions: [
      'seeWeeklySummaryReports',
      'assignOnlyBlueSquares',
      'suggestTask',
    ],
    permissionsBackEnd: [
      'getUserProfiles',
      'getProjectMembers',
      'putUserProfile',
      'infringementAuthorizer',
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
      'getWeeklySummaries',
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Owner',
    permissions: [
      'seeWeeklySummaryReports',
      'seeUserManagement',
      'seeBadgeManagement',
      'seePopupManagement',
      'seeProjectManagement',
      'seeTeamsManagement',
      'deleteOwnBadge',
      'modifyOwnBadgeAmount',
      'assignBadgeOthers',
      'editTimelogInfo',
      'addTimeEntryOthers',
      'deleteTimeEntryOthers',
      'toggleTangibleTime',
      'changeIntangibleTimeEntryDate',
      'editTimeEntry',
      'deleteTimeEntry',
      'deleteWbs',
      'addTask',
      'deleteTask',
      'editTask',
      'addWbs',
      'addProject',
      'deleteProject',
      'editProject',
      'findUserInProject',
      'assignUserInProject',
      'unassignUserInProject',
      'adminLinks',
      'editUserProfile',
      'assignTeamToUser',
      'createTeam',
      'editDeleteTeam',
      'seeUserProfileInProjects',
      'handleBlueSquare',
      'resetPasswordOthers',
      'dataIsTangibleTimelog',
      'addDeleteEditOwners',
      'toggleSubmitForm',
      'seePermissionsManagement',
      'putUserProfilePermissions',
      'changeBioAnnouncement',
      'seeAllReports',
      'changeUserStatus',
      'submitWeeklySummaryForOthers',
      'seeAllReports',
      'removeUserFromTask',
    ],
    permissionsBackEnd: [
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
      'deleteTeam',
      'putTeam',
      'assignTeamToUsers',
      'editTimeEntry',
      'deleteTimeEntry',
      'updatePassword',
      'getUserProfiles',
      'getProjectMembers',
      'postUserProfile',
      'putUserProfile',
      'putUserProfileImportantInfo',
      'deleteUserProfile',
      'infringementAuthorizer',
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
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
];


const createInitialPermissionsFront = async () => {
  const userEmail = { email: 'jae@onecommunityglobal.org' };
  const update = { role: 'Owner' };
  await User.findOneAndUpdate(userEmail, update);

  const allRoles = await Role.find();
  const ownerRoleDataBase = allRoles.find(
    role => role.roleName === 'Owner',
  );

  let ownerRoleId;
  let IsAllBackPermissionsOwnerUpdated = true;
  let IsAllFrontPermissionsOwnerUpdated = true;
  const updatedOwnerPermissions = {};

  for (let i = 0; i < permissionsRoles.length; i += 1) {
      const { roleName, permissions, permissionsBackEnd } = permissionsRoles[i];

      // Add a new permission if the role Owner has been changed in the  permissionsRoles Array
      if (roleName === 'Owner' && ownerRoleDataBase) {
        ownerRoleId = ownerRoleDataBase._id;
        const permissionsBackOwnerDataBase = ownerRoleDataBase.permissionsBackEnd;
        const permissionsFrontOwnerDataBase = ownerRoleDataBase.permissions;
         IsAllBackPermissionsOwnerUpdated = permissionsBackOwnerDataBase.every(perm => permissions.includes(perm));
         IsAllFrontPermissionsOwnerUpdated = permissionsFrontOwnerDataBase.every(perm => permissionsBackEnd.includes(perm));

        if (!IsAllFrontPermissionsOwnerUpdated) {
        updatedOwnerPermissions.permissions = permissions;
        }
        if (!IsAllBackPermissionsOwnerUpdated) {
        updatedOwnerPermissions.permissionsBackEnd = permissionsBackEnd;
        }
      }

      const hasRoleInDataBase = allRoles.some(role => role.roleName === roleName);
      if (!hasRoleInDataBase) {
        const role = new Role();
        role.roleName = roleName;
        role.permissions = permissions;
        role.permissionsBackEnd = permissionsBackEnd;
        role.save();
      }
  }

  if (!IsAllFrontPermissionsOwnerUpdated) {
    await Role.findById(ownerRoleId, (_, record) => {
      record.permissions = updatedOwnerPermissions.permissions;
      record.save();
    });
  }

if (!IsAllBackPermissionsOwnerUpdated) {
  await Role.findById(ownerRoleId, (_, record) => {
    record.permissionsBackEnd = updatedOwnerPermissions.permissionsBackEnd;
    record.save();
  });
}
};
module.exports = createInitialPermissionsFront;
