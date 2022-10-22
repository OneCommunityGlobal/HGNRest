
const Role = require('../models/role');

const permissionsRoles = [
    {
      roleName: 'Administrator',
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
        'seeUserProfileInProjects',
        'createTeam',
        'editDeleteTeam',
        'handleBlueSquare',
        'resetPasswordOthers',
        'dataIsTangibleTimelog',
        'toggleSubmitForm',
        'seePermissionsManagement',
      ],
    },
    {
      roleName: 'Volunteer',
      permissions: ['V'],
    },
    {
      roleName: 'Core Team',
      permissions: ['seeWeeklySummaryReports'],
    },
    {
      roleName: 'Manager',
      permissions: [
        'seeWeeklySummaryReports',
        'assignOnlyBlueSquares',
        'editTask',
      ],
    },
    {
      roleName: 'Mentor',
      permissions: [
        'seeWeeklySummaryReports',
        'assignOnlyBlueSquares',
        'editTask',
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
      ],
    },
  ];
const createInitialPermissionsFront = () => {
  console.log(permissionsRoles);
    permissionsRoles.forEach(({ roleName, permissions }) => {
        const allRoles = Role.find();
        if (allRoles.some(role => role.roleName === roleName)) {
            const role = new Role();
            role.roleName = roleName;
            role.permissions = permissions;
            role.save();
        }
    });
  };

  module.exports = createInitialPermissionsFront;
