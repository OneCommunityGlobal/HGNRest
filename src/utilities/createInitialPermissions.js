const Role = require('../models/role');
const User = require('../models/userProfile');

const permissionsRoles = [
  {
    roleName: 'Administrator',
    permissions: [
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
      'editTimeEntry',
      'deleteTimeEntry',
      // 'postTimeEntry',?
      // User Profile
      'postUserProfile',
      'putUserProfile',
      'putUserProfileImportantInfo',
      'updatePassword',
      'deleteUserProfile',
      'infringementAuthorizer',
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
      'getWeeklySummaries',
      // 'getReportsPage',?
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
    ],
  },
  {
    roleName: 'Volunteer',
    permissions: ['getReporteesLimitRoles'],
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
      'infringementAuthorizer',
      'getReporteesLimitRoles',
      'suggestTask',
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
      'suggestTask',
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
      'postRole',
      'deleteRole',
      'putRole',
      'addDeleteEditOwners',
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


const createInitialPermissions = async () => {
  // Create Initial Owner
  const userEmail = { email: 'jae@onecommunityglobal.org' };
  const update = { role: 'Owner' };
  await User.findOneAndUpdate(userEmail, update);

  // Get Roles From DB
  const allRoles = await Role.find();
  const onlyUpdateOwner = false;

  const promises = [];
  // Add a new permission if the role has been changed in the  permissionsRoles Array
  for (let i = 0; i < permissionsRoles.length; i += 1) {
    const { roleName, permissions } = permissionsRoles[i];

    if (!onlyUpdateOwner || roleName === 'Owner') {
      const roleDataBase = allRoles.find(role => role.roleName === roleName);

      // If role does not exist in db, create it
      if (!roleDataBase) {
        const role = new Role();
        role.roleName = roleName;
        role.permissions = permissions;
        role.save();

      // If role exists in db and is not updated, update it
      } else if (!roleDataBase.permissions.every(perm => permissions.includes(perm)) || !permissions.every(perm => roleDataBase.permissions.includes(perm))) {
        const roleId = roleDataBase._id;

        promises.push(Role.findById(roleId, (_, record) => {
          record.permissions = permissions;
          record.save();
        }));
      }
    }
  }
  await Promise.all(promises);
};
module.exports = createInitialPermissions;
