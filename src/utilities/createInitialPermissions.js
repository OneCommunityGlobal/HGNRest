const Role = require('../models/role');
const RolePreset = require('../models/rolePreset');
const User = require('../models/userProfile');

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
      'editTimeEntryDescription',
      'editTimeEntryDate',
      'editTimeEntryToggleTangible',
      'deleteTimeEntry',
      'postTimeEntry',
      // User Profile
      'putUserProfilePermissions',
      'postUserProfile',
      'putUserProfile',
      'putUserProfileImportantInfo',
      'changeUserStatus',
      'changeUserRehireableStatus',
      'updatePassword',
      'resetPassword',
      'deleteUserProfile',
      'infringementAuthorizer',
      'manageAdminLinks',
      'manageTimeOffRequests',
      'changeUserRehireableStatus',
      'updateSummaryRequirements',
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

      // Title
      'seeQSC',
      'addNewTitle',
      'assignTitle',

      'seeUsersInDashboard',
      'editTeamCode',
    ],
  },
  {
    roleName: 'Volunteer',
    permissions: ['suggestTask'],
  },
  {
    roleName: 'Core Team',
    permissions: [
      'getReports',
      'getWeeklySummaries',
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
      'seeUsersInDashboard',
    ],
  },
  {
    roleName: 'Manager',
    permissions: [
      'getReporteesLimitRoles',
      'postTask',
      'updateTask',
      'suggestTask',
      'putReviewStatus',
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
      'updateTask',
      'suggestTask',
      'putReviewStatus',
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
      'highlightEligibleBios',
      'manageTimeOffRequests',
      'changeUserRehireableStatus',
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
      'resolveTask',
      'suggestTask',
      'putReviewStatus',
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
      'updatePassword',
      'resetPassword',
      'getUserProfiles',
      'getProjectMembers',
      'postUserProfile',
      'putUserProfile',
      'putUserProfileImportantInfo',
      'updateSummaryRequirements',
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
      'getReports',
      'getTimeZoneAPIKey',
      'checkLeadTeamOfXplus',
      'editTeamCode',
      'totalValidWeeklySummaries',

      // Title
      'seeQSC',
      'addNewTitle',
      'assignTitle',

      'seeUsersInDashboard',

      'changeUserRehireableStatus',
      'manageAdminLinks',
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
  const allPresets = await RolePreset.find();
  const onlyUpdateOwner = false;

  const promises = [];
  // Add a new permission if the role has been changed in the  permissionsRoles Array
  for (let i = 0; i < permissionsRoles.length; i += 1) {
    const { roleName, permissions } = permissionsRoles[i];

    if (!onlyUpdateOwner || roleName === 'Owner') {
      const roleDataBase = allRoles.find((role) => role.roleName === roleName);

      // If role does not exist in db, create it
      if (!roleDataBase) {
        const role = new Role();
        role.roleName = roleName;
        role.permissions = permissions;
        role.save();

        // If role exists in db and does not have every permission, add the missing permissions
      } else if (!permissions.every((perm) => roleDataBase.permissions.includes(perm))) {
        const roleId = roleDataBase._id;

        promises.push(
          Role.findById(roleId, (_, record) => {
            permissions.forEach((perm) => {
              if (!record.permissions.includes(perm)) {
                record.permissions.push(perm);
              }
            });
            record.save();
          }),
        );
      }
    }

    // Update Default presets
    const defaultName = 'hard-coded default';

    const presetDataBase = allPresets.find(
      (preset) => preset.roleName === roleName && preset.presetName === defaultName,
    );

    // If role does not exist in db, create it
    if (!presetDataBase) {
      const defaultPreset = new RolePreset();
      defaultPreset.roleName = roleName;
      defaultPreset.presetName = defaultName;
      defaultPreset.permissions = permissions;
      defaultPreset.save();

      // If role exists in db and is not updated, update default
    } else if (
      !presetDataBase.permissions.every((perm) => permissions.includes(perm)) ||
      !permissions.every((perm) => presetDataBase.permissions.includes(perm))
    ) {
      const presetId = presetDataBase._id;

      promises.push(
        RolePreset.findById(presetId, (_, record) => {
          record.permissions = permissions;
          record.save();
        }),
      );
    }
  }
  await Promise.all(promises);
};
module.exports = createInitialPermissions;
