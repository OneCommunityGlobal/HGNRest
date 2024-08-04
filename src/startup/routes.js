const timeEntry = require('../models/timeentry');
const userProfile = require('../models/userProfile');
const project = require('../models/project');
const information = require('../models/information');
const team = require('../models/team');
// const actionItem = require('../models/actionItem');
// const notification = require('../models/notification');
const wbs = require('../models/wbs');
const task = require('../models/task');
const popup = require('../models/popupEditor');
const popupBackup = require('../models/popupEditorBackup');
const taskNotification = require('../models/taskNotification');
const badge = require('../models/badge');
const inventoryItem = require('../models/inventoryItem');
const inventoryItemType = require('../models/inventoryItemType');
const role = require('../models/role');
const rolePreset = require('../models/rolePreset');
const ownerMessage = require('../models/ownerMessage');
// Title
const title = require('../models/title');
const blueSquareEmailAssignment = require('../models/BlueSquareEmailAssignment');

const weeklySummaryAIPrompt = require('../models/weeklySummaryAIPrompt');
const profileInitialSetuptoken = require('../models/profileInitialSetupToken');
const reason = require('../models/reason');
const mouseoverText = require('../models/mouseoverText');
const permissionChangeLog = require('../models/permissionChangeLog');
const mapLocations = require('../models/mapLocation');
const buildingProject = require('../models/bmdashboard/buildingProject');
const buildingNewLesson = require('../models/bmdashboard/buildingNewLesson');
const buildingIssue = require('../models/bmdashboard/buildingIssue');
const {
  invTypeBase,
  materialType,
  consumableType,
  reusableType,
  toolType,
  equipmentType,
} = require('../models/bmdashboard/buildingInventoryType');
const {
  buildingConsumable,
  buildingReusable,
  buildingMaterial,
  buildingTool,
  buildingEquipment,
} = require('../models/bmdashboard/buildingInventoryItem');
const timeOffRequest = require('../models/timeOffRequest');
const followUp = require('../models/followUp');

const userProfileRouter = require('../routes/userProfileRouter')(userProfile, project);
const warningRouter = require('../routes/warningRouter')(userProfile);
const badgeRouter = require('../routes/badgeRouter')(badge);
const dashboardRouter = require('../routes/dashboardRouter')(weeklySummaryAIPrompt);
const timeEntryRouter = require('../routes/timeentryRouter')(timeEntry);
const projectRouter = require('../routes/projectRouter')(project);
const informationRouter = require('../routes/informationRouter')(information);
const teamRouter = require('../routes/teamRouter')(team);
// const actionItemRouter = require('../routes/actionItemRouter')(actionItem);
const notificationRouter = require('../routes/notificationRouter')();
const loginRouter = require('../routes/loginRouter')();
const forgotPwdRouter = require('../routes/forgotPwdRouter')(userProfile);
const forcePwdRouter = require('../routes/forcePwdRouter')(userProfile);
const reportsRouter = require('../routes/reportsRouter')();
const wbsRouter = require('../routes/wbsRouter')(wbs);
const taskRouter = require('../routes/taskRouter')(task);
const popupRouter = require('../routes/popupEditorRouter')(popup);
const popupBackupRouter = require('../routes/popupEditorBackupRouter')(popupBackup);
const taskNotificationRouter = require('../routes/taskNotificationRouter')(taskNotification);
const inventoryRouter = require('../routes/inventoryRouter')(inventoryItem, inventoryItemType);
const timeZoneAPIRouter = require('../routes/timeZoneAPIRoutes')();
const profileInitialSetupRouter = require('../routes/profileInitialSetupRouter')(
  profileInitialSetuptoken,
  userProfile,
  project,
  mapLocations,
);
const permissionChangeLogRouter = require('../routes/permissionChangeLogsRouter')(
  permissionChangeLog,
);
const isEmailExistsRouter = require('../routes/isEmailExistsRouter')();

const taskEditSuggestion = require('../models/taskEditSuggestion');
const taskEditSuggestionRouter = require('../routes/taskEditSuggestionRouter')(taskEditSuggestion);
const roleRouter = require('../routes/roleRouter')(role);
const rolePresetRouter = require('../routes/rolePresetRouter')(rolePreset);
const ownerMessageRouter = require('../routes/ownerMessageRouter')(ownerMessage);

const emailRouter = require('../routes/emailRouter')();
const reasonRouter = require('../routes/reasonRouter')(reason, userProfile);
const mouseoverTextRouter = require('../routes/mouseoverTextRouter')(mouseoverText);

const mapLocationRouter = require('../routes/mapLocationsRouter')(mapLocations);
const timeOffRequestRouter = require('../routes/timeOffRequestRouter')(
  timeOffRequest,
  team,
  userProfile,
);
const followUpRouter = require('../routes/followUpRouter')(followUp);

// bm dashboard
const bmLoginRouter = require('../routes/bmdashboard/bmLoginRouter')();
const bmMaterialsRouter = require('../routes/bmdashboard/bmMaterialsRouter')(buildingMaterial);
const bmReusableRouter = require('../routes/bmdashboard/bmReusableRouter')(buildingReusable);
const bmProjectRouter = require('../routes/bmdashboard/bmProjectRouter')(buildingProject);
const bmTimeLoggerRouter = require('../routes/bmdashboard/bmTimeLoggerRouter')();
const bmNewLessonRouter = require('../routes/bmdashboard/bmNewLessonRouter')(buildingNewLesson);
const bmConsumablesRouter = require('../routes/bmdashboard/bmConsumablesRouter')(
  buildingConsumable,
);
const bmInventoryTypeRouter = require('../routes/bmdashboard/bmInventoryTypeRouter')(
  invTypeBase,
  materialType,
  consumableType,
  reusableType,
  toolType,
  equipmentType,
);

const titleRouter = require('../routes/titleRouter')(title);
const bmToolRouter = require('../routes/bmdashboard/bmToolRouter')(buildingTool, toolType);
const bmEquipmentRouter = require('../routes/bmdashboard/bmEquipmentRouter')(buildingEquipment);
const bmIssueRouter = require('../routes/bmdashboard/bmIssueRouter')(buildingIssue);

const blueSquareEmailAssignmentRouter = require('../routes/BlueSquareEmailAssignmentRouter')(
  blueSquareEmailAssignment,
  userProfile,
);

module.exports = function (app) {
  app.use('/api', forgotPwdRouter);
  app.use('/api', loginRouter);
  app.use('/api', forcePwdRouter);
  app.use('/api', projectRouter);
  app.use('/api', userProfileRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', timeEntryRouter);
  app.use('/api', teamRouter);
  // app.use('/api', actionItemRouter);
  app.use('/api', notificationRouter);
  app.use('/api', reportsRouter);
  app.use('/api', wbsRouter);
  app.use('/api', taskRouter);
  app.use('/api', popupRouter);
  app.use('/api', popupBackupRouter);
  app.use('/api', taskNotificationRouter);
  app.use('/api', badgeRouter);
  app.use('/api', inventoryRouter);
  app.use('/api', timeZoneAPIRouter);
  app.use('/api', taskEditSuggestionRouter);
  app.use('/api', roleRouter);
  app.use('/api', rolePresetRouter);
  app.use('/api', ownerMessageRouter);
  app.use('/api', profileInitialSetupRouter);
  app.use('/api', reasonRouter);
  app.use('/api', informationRouter);
  app.use('/api', mouseoverTextRouter);
  app.use('/api', permissionChangeLogRouter);
  app.use('/api', emailRouter);
  app.use('/api', isEmailExistsRouter);
  app.use('/api', mapLocationRouter);
  app.use('/api', warningRouter);
  app.use('/api', titleRouter);
  app.use('/api', timeOffRequestRouter);
  app.use('/api', followUpRouter);
  app.use('/api', blueSquareEmailAssignmentRouter);
  // bm dashboard
  app.use('/api/bm', bmLoginRouter);
  app.use('/api/bm', bmMaterialsRouter);
  app.use('/api/bm', bmReusableRouter);
  app.use('/api/bm', bmProjectRouter);
  app.use('/api/bm', bmTimeLoggerRouter);  
  app.use('/api/bm', bmNewLessonRouter);
  app.use('/api/bm', bmInventoryTypeRouter);
  app.use('/api/bm', bmToolRouter);
  app.use('/api/bm', bmEquipmentRouter);
  app.use('/api/bm', bmConsumablesRouter);
  app.use('api', bmIssueRouter);
};