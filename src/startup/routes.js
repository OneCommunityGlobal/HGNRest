const timeEntry = require('../models/timeentry');
const userProfile = require('../models/userProfile');
const project = require('../models/project');
const information = require('../models/information');
const team = require('../models/team');
// const actionItem = require('../models/actionItem');
/* eslint-disable */
const notification = require('../models/notification');
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
const currentWarnings = require('../models/currentWarnings');
const availability = require('../models/lbdashboard/availability');

const listingAvailablityRouter = require('../routes/lbdashboard/listingAvailablityRouter')(
  availability,
);
const savedFilter = require('../models/savedFilter');

const hgnFormResponses = require('../models/hgnFormResponse');

const listings = require('../models/lbdashboard/listings');
const biddingHome = require('../models/lbdashboard/biddings');
const village = require('../models/lbdashboard/villages');
const event = require('../models/event');
const registration = require('../models/registration');
const projectCost = require('../models/bmdashboard/projectCost');
const userPreferences = require('../models/lbdashboard/userPreferences');
const message = require('../models/lbdashboard/message');
const helpCategory = require('../models/helpCategory');
const wishlists = require('../models/lbdashboard/wishlists');
const popularityTimelineRoutes = require('../routes/popularityTimeline');
const pledgeAnalyticsRoutes = require('../routes/pledgeAnalytics');
const popularityEnhancedRoutes = require('../routes/popularityEnhancedRoutes');

const PRReviewInsights = require('../models/prAnalytics/prReviewsInsights');
const WeeklyGrading = require('../models/prAnalytics/weeklyGrading');

// Title
const title = require('../models/title');
const blueSquareEmailAssignment = require('../models/BlueSquareEmailAssignment');
const hgnformRouter = require('../routes/hgnformRouter');
const hgnFormResponseRouter = require('../routes/hgnFormResponseRouter');

const questionnaireAnalyticsRouter = require('../routes/questionnaireAnalyticsRouter');
const applicantAnalyticsRouter = require('../routes/applicantAnalyticsRoutes');
const weeklySummaryAIPrompt = require('../models/weeklySummaryAIPrompt');

const weeklySummaryEmailAssignment = require('../models/WeeklySummaryEmailAssignment');

const profileInitialSetuptoken = require('../models/profileInitialSetupToken');
const reason = require('../models/reason');
const mouseoverText = require('../models/mouseoverText');
const permissionChangeLog = require('../models/permissionChangeLog');
const userPermissionChangeLog = require('../models/userPermissionChangeLog');
const mapLocations = require('../models/mapLocation');
const buildingProject = require('../models/bmdashboard/buildingProject');
const buildingNewLesson = require('../models/bmdashboard/buildingNewLesson');
const metIssue = require('../models/bmdashboard/metIssue');
const projectStatus = require('../models/bmdashboard/project');

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
const dashboardMetrics = require('../models/bmdashboard/dashboardMetrics');
const bmTimeLog = require('../models/bmdashboard/buildingTimeLogger');

const buildingToolModel = require('../models/bmdashboard/buildingTool');
const buildingMaterialModel = require('../models/bmdashboard/buildingMaterial');

const timeOffRequest = require('../models/timeOffRequest');
const followUp = require('../models/followUp');

const supplierPerformance = require('../models/summaryDashboard/supplierPerformance');
const costs = require('../models/costs');
const tag = require('../models/tag');
const educationTask = require('../models/educationTask');
const injujrySeverity = require('../models/bmdashboard/injujrySeverity');

const browsableLessonPlanModel = require('../models/educationPortal/browsableLessonPlanModel');
const browsableLessonPlanRouter = require('../routes/educationPortal/browsableLessonPlanRouter')(
  browsableLessonPlanModel,
  userProfile,
);

const bidoverview_Listing = require('../models/lbdashboard/bidoverview/Listing');
const bidoverview_Bid = require('../models/lbdashboard/bidoverview/Bid');
const bidoverview_User = require('../models/lbdashboard/bidoverview/User');
const bidoverview_Notification = require('../models/lbdashboard/bidoverview/Notification');
const hoursPledgedRoutes = require('../routes/jobAnalytics/hoursPledgedRoutes');

const userProfileRouter = require('../routes/userProfileRouter')(userProfile, project);
const userSkillTabsRouter = require('../routes/userSkillTabsRouter')(hgnFormResponses);
const warningRouter = require('../routes/warningRouter')(userProfile);
const currentWarningsRouter = require('../routes/curentWarningsRouter')(currentWarnings);
const badgeRouter = require('../routes/badgeRouter')(badge);
const dashboardRouter = require('../routes/dashboardRouter')(weeklySummaryAIPrompt);
const timeEntryRouter = require('../routes/timeentryRouter')(timeEntry);
const projectStatusRouter = require('../routes/projectStatusRouter')(projectStatus);
const projectsGlobalDistributionRouter = require('../routes/projectsGlobalDistributionRouter');
const timelogTrackingRouter = require('../routes/timelogTrackingRouter')();
const projectRouter = require('../routes/projectRouter')(project);
const informationRouter = require('../routes/informationRouter')(information);
const teamRouter = require('../routes/teamRouter')(team);
const jobsRouter = require('../routes/jobsRouter');
const laborCostRouter = require('../routes/laborCostRouter');
const jobAnalyticsRouter = require('../routes/jobAnalyticsRouter');
const liveJournalPost = require('../models/liveJournalPost');

// const actionItemRouter = require('../routes/actionItemRouter')(actionItem);
// const actionItemRouter = require('../routes/actionItemRouter')(actionItem);
// const actionItemRouter = require('../routes/actionItemRouter')(actionItem);
const notificationRouter = require('../routes/notificationRouter')();
const loginRouter = require('../routes/loginRouter')();
const forgotPwdRouter = require('../routes/forgotPwdRouter')(userProfile);
const forcePwdRouter = require('../routes/forcePwdRouter')(userProfile);
const reportsRouter = require('../routes/reportsRouter')();
const wbsRouter = require('../routes/wbsRouter')(wbs);
const taskRouter = require('../routes/taskRouter')(task);
const studentTaskRouter = require('../routes/studentTaskRouter')();
const popupRouter = require('../routes/popupEditorRouter')(popup);
const popupBackupRouter = require('../routes/popupEditorBackupRouter')(popupBackup);
const taskNotificationRouter = require('../routes/taskNotificationRouter')(taskNotification);
const inventoryRouter = require('../routes/inventoryRouter')(
  inventoryItem,
  inventoryItemType,
  project,
);
const timeZoneAPIRouter = require('../routes/timeZoneAPIRoutes')();
const profileInitialSetupRouter = require('../routes/profileInitialSetupRouter')(
  profileInitialSetuptoken,
  userProfile,
  project,
  mapLocations,
);
const permissionChangeLogRouter = require('../routes/permissionChangeLogsRouter')(
  permissionChangeLog,
  userPermissionChangeLog,
);
const isEmailExistsRouter = require('../routes/isEmailExistsRouter')();
const jobNotificationListRouter = require('../routes/jobNotificationListRouter');
const helpCategoryRouter = require('../routes/helpCategoryRouter');

const materialUtilizationRouter = require('../routes/materialUtilizationRouter');

const userSkillsProfileRouter = require('../routes/userSkillsProfileRouter')(userProfile);

const faqRouter = require('../routes/faqRouter');

const taskEditSuggestion = require('../models/taskEditSuggestion');
const taskEditSuggestionRouter = require('../routes/taskEditSuggestionRouter')(taskEditSuggestion);
const roleRouter = require('../routes/roleRouter')(role);
const rolePresetRouter = require('../routes/rolePresetRouter')(rolePreset);
const ownerMessageRouter = require('../routes/ownerMessageRouter')(ownerMessage);
const ownerMessageLogRouter = require('../routes/ownerMessageLogRouter')();

const emailRouter = require('../routes/emailRouter')();
const emailOutboxRouter = require('../routes/emailOutboxRouter');
const reasonRouter = require('../routes/reasonRouter')(reason, userProfile);
const mouseoverTextRouter = require('../routes/mouseoverTextRouter')(mouseoverText);

const mapLocationRouter = require('../routes/mapLocationsRouter')(mapLocations);
const timeOffRequestRouter = require('../routes/timeOffRequestRouter')(
  timeOffRequest,
  team,
  userProfile,
);
const followUpRouter = require('../routes/followUpRouter')(followUp);
const communityRouter = require('../routes/communityRouter');
const costsRouter = require('../routes/costsRouter')(costs);
const form = require('../models/forms');
const formResponse = require('../models/formResponse');
const formRouter = require('../routes/formRouter')(form, formResponse);

const wastedMaterialRouter = require('../routes/mostWastedRouter');
const weeklySummariesFilterRouter = require('../routes/weeklySummariesFilterRouter')();

const jobAnalyticsRoutes = require('../routes/jobAnalytics');

const materialCostRouter = require('../routes/materialCostRouter')();

// bm dashboard
const bmLoginRouter = require('../routes/bmdashboard/bmLoginRouter')();
const bmMaterialsRouter = require('../routes/bmdashboard/bmMaterialsRouter')(buildingMaterial);
const bmReusableRouter = require('../routes/bmdashboard/bmReusableRouter')(buildingReusable);
const bmProjectRouter = require('../routes/bmdashboard/bmProjectRouter')(buildingProject);

const bmNewLessonRouter = require('../routes/bmdashboard/bmNewLessonRouter')(buildingNewLesson);
const injuryCategoryRoutes = require('../routes/bmdashboard/injuryCategoryRouter');
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

const toolAvailabilityRoutes = require('../routes/bmdashboard/bmToolAvailabilityRoutes');
const bmDashboardRouter = require('../routes/bmdashboard/bmDashboardPrototypeRouter')(
  dashboardMetrics,
  buildingProject,
  buildingMaterial,
);

const bmTimeLoggerRouter = require('../routes/bmdashboard/bmTimeLoggerRouter')(bmTimeLog);
const bmPaidLaborCostRouter = require('../routes/bmdashboard/bmPaidLaborCostRouter');
const bmProjectRiskProfileRouter = require('../routes/bmdashboard/bmProjectRiskProfileRouter');
const bmIssuesRouter = require('../routes/bmdashboard/IssuesRouter');

// lb dashboard
const lbListingsRouter = require('../routes/lbdashboard/listingsRouter')(listings);

const lbWishlistsRouter = require('../routes/lbdashboard/wishlistsRouter')(wishlists);
const biddingRouter = require('../routes/lbdashboard/biddingRouter')(biddingHome);
const titleRouter = require('../routes/titleRouter')(title);
const bmToolRouter = require('../routes/bmdashboard/bmToolRouter')(buildingTool, toolType);
const bmEquipmentRouter = require('../routes/bmdashboard/bmEquipmentRouter')(buildingEquipment);
const bmUpdateHistoryRouter = require('../routes/bmdashboard/bmUpdateHistoryRouter')();
const buildingIssue = require('../models/bmdashboard/buildingIssue');
const bmIssueRouter = require('../routes/bmdashboard/bmIssueRouter')(buildingIssue);
const bmInjuryRouter = require('../routes/bmdashboard/bmInjuryRouter')(injujrySeverity);

const bmExternalTeam = require('../routes/bmdashboard/bmExternalTeamRouter');
const bmActualVsPlannedCostRouter = require('../routes/bmdashboard/bmActualVsPlannedCostRouter');
const bmRentalChart = require('../routes/bmdashboard/bmRentalChartRouter')();
const bmToolsReturnedLateRouter = require('../routes/bmdashboard/bmToolsReturnedLateRouter')();
const toolUtilizationRouter = require('../routes/bmdashboard/toolUtilizationRouter')(buildingTool);
const bmToolsDowntimeRouter = require('../routes/bmdashboard/bmToolsDowntimeRouter');

const lbMessageRouter = require('../routes/lbdashboard/messagesRouter')(message);
const lbUserPrefRouter = require('../routes/lbdashboard/userPreferencesRouter')(
  userPreferences,
  notification,
);
const bmFinancialRouter = require('../routes/bmdashboard/bmFinancialRouter')(
  buildingProject,
  buildingMaterialModel,
  buildingToolModel,
);
const bookingRouter = require('../routes/lbdashboard/bookingsRouter');
const toolAvailability = require('../models/bmdashboard/toolAvailability');
const toolAvailabilityRouter = require('../routes/bmdashboard/toolAvailabilityRouter')(
  toolAvailability,
);

const downloadReportRouter = require('../routes/educationPortal/downloadReportRouter');

const projectCostTracking = require('../models/bmdashboard/projectCostTracking');
const projectCostTrackingRouter = require('../routes/bmdashboard/projectCostTrackingRouter')(
  projectCostTracking,
);

const blueSquareEmailAssignmentRouter = require('../routes/BlueSquareEmailAssignmentRouter')(
  blueSquareEmailAssignment,
  userProfile,
);
// PR Analytics
const prInsightsRouter = require('../routes/prAnalytics/prInsightsRouter')(
  PRReviewInsights,
  userProfile,
);
const weeklyGradingRouter = require('../routes/prAnalytics/weeklyGradingRouter')(WeeklyGrading);

const eventRouter = require('../routes/eventRouter');
const weeklySummaryEmailAssignmentRouter = require('../routes/WeeklySummaryEmailAssignmentRoute')(
  weeklySummaryEmailAssignment,
  userProfile,
);

// Automations
const appAccessRouter = require('../routes/automation/appAccessRouter');
const dropboxRouter = require('../routes/automation/dropboxRouter');
const githubRouter = require('../routes/automation/githubRouter');
const sentryRouter = require('../routes/automation/sentryRouter');
const slackRouter = require('../routes/automation/slackRouter');
const liveJournalRoutes = require('../routes/liveJournalRoutes');
//lbdashboard_bidoverview

const bidPropertyRouter = require('../routes/lbdashboard/bidPropertyRouter')(bidoverview_Listing);
const userBidRouter = require('../routes/lbdashboard/userBidNotificationRouter')(
  bidoverview_Bid,
  bidoverview_Listing,
  bidoverview_User,
  bidoverview_Notification,
);

//commnunity portal
const cpNoShowRouter = require('../routes/CommunityPortal/NoshowVizRouter')();
const cpEventFeedbackRouter = require('../routes/CommunityPortal/eventFeedbackRouter');
const resourceManagementRouter = require('../routes/resourceManagementRouter');

const collaborationRouter = require('../routes/collaborationRouter');

// summary dashboard routes
const supplierPerformanceRouter = require('../routes/summaryDashboard/supplierPerformanceRouter')();
const laborHoursDistributionRouter =
  require('../routes/summaryDashboard/laborHoursDistributionRouter')();

const registrationRouter = require('../routes/registrationRouter')(registration);

const templateRouter = require('../routes/templateRouter');
const emailTemplateRouter = require('../routes/emailTemplateRouter');

const projectMaterialRouter = require('../routes/projectMaterialroutes');
console.log('Loading plannedCost model...');
const plannedCost = require('../models/plannedCost');
console.log('PlannedCost model loaded:', plannedCost ? 'success' : 'failed');

console.log('Loading plannedCostRouter...');
const plannedCostRouter = require('../routes/plannedCostRouter');
console.log('PlannedCostRouter loaded:', plannedCostRouter ? 'success' : 'failed');

const projectCostRouter = require('../routes/bmdashboard/projectCostRouter')(projectCost);

const tagRouter = require('../routes/tagRouter')(tag);
const educationTaskRouter = require('../routes/educationTaskRouter');
const educatorRouter = require('../routes/educatorRouter');
const atomRouter = require('../routes/atomRouter');
const intermediateTaskRouter = require('../routes/intermediateTaskRouter');
const savedFilterRouter = require('../routes/savedFilterRouter')(savedFilter);
// lbdashboard
const bidTermsRouter = require('../routes/lbdashboard/bidTermsRouter');
const bidsRouter = require('../routes/lbdashboard/bidsRouter');
const paymentsRouter = require('../routes/lbdashboard/paymentsRouter');
const webhookRouter = require('../routes/lbdashboard/webhookRouter');
const bidNotificationsRouter = require('../routes/lbdashboard/bidNotificationsRouter');
const bidDeadlinesRouter = require('../routes/lbdashboard/bidDeadlinesRouter');
const SMSRouter = require('../routes/lbdashboard/SMSRouter')();

const applicantVolunteerRatioRouter = require('../routes/applicantVolunteerRatioRouter');
const applicationRoutes = require('../routes/applications');
const announcementRouter = require('../routes/announcementRouter')();

const permissionRouter = require('../routes/permissionRouter');

// Analytics
const analyticsPopularPRsRouter = require('../routes/analyticsPopularPRsRouter')();
const PromotionEligibility = require('../models/promotionEligibility');

const promotionEligibilityRouter = require('../routes/promotionEligibilityRouter');

// education portal
const educationProfileRouter = require('../routes/educationRouter');

// lesson planner router

const lessonPlanSubmissionRouter = require('../routes/lessonPlanner/lessonPlanSubmissionRouter');

// education portal

const epBadge = require('../models/educationPortal/badgeModel');
const studentBadges = require('../models/educationPortal/studentBadgesModel');
const badgeSystemRouter = require('../routes/educationPortal/badgeSystemRouter');

const promotionDetailsRouter = require('../routes/promotionDetailsRouter');

const summaryDashboardRouter = require('../routes/summaryDashboard.routes');

// Actual Cost
const actualCostRouter = require('../routes/actualCostRouter')();

module.exports = function (app) {
  app.use('/api/bm/summary-dashboard', summaryDashboardRouter);
  app.use('/api', forgotPwdRouter);
  app.use('/api', loginRouter);
  app.use('/api', forcePwdRouter);
  app.use('/api', projectRouter);
  app.use('/api', userProfileRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', timeEntryRouter);
  app.use('/api', timelogTrackingRouter);
  app.use('/api', teamRouter);
  app.use('/api', wastedMaterialRouter);
  app.use('/api/permission-management', permissionRouter(userProfile));

  app.use('/api', laborCostRouter);
  // app.use('/api', actionItemRouter);
  app.use('/api', notificationRouter);
  app.use('/api', announcementRouter);
  app.use('/api', reportsRouter);
  app.use('/api', wbsRouter);
  app.use('/api', taskRouter);
  app.use('/api', studentTaskRouter);
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
  app.use('/api', ownerMessageLogRouter);
  app.use('/api', profileInitialSetupRouter);
  app.use('/api', reasonRouter);
  app.use('/api', informationRouter);
  app.use('/api', mouseoverTextRouter);
  app.use('/api', permissionChangeLogRouter);
  app.use('/api', emailOutboxRouter);
  app.use('/api', emailRouter);
  app.use('/api', isEmailExistsRouter);
  app.use('/api', faqRouter);
  app.use('/api', mapLocationRouter);
  app.use('/api', warningRouter);
  app.use('/api', currentWarningsRouter);
  app.use('/api', titleRouter);
  app.use('/api', timeOffRequestRouter);
  app.use('/api', followUpRouter);
  app.use('/api', blueSquareEmailAssignmentRouter);
  app.use('/api', weeklySummaryEmailAssignmentRouter);
  app.use('/api', materialUtilizationRouter);

  app.use('/api', formRouter);
  app.use('/api', collaborationRouter);
  app.use('/api', userSkillsProfileRouter);
  app.use('/api', savedFilterRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/questions', hgnformRouter);
  app.use('/api/issues', bmIssuesRouter);
  app.use('/api/hgnform', hgnFormResponseRouter);
  app.use('/api/skills', userSkillTabsRouter);
  app.use('/api/questionnaire-analytics/', questionnaireAnalyticsRouter);
  app.use('/api/applicant-analytics/', applicantAnalyticsRouter);
  app.use('/api/job-notification-list/', jobNotificationListRouter);

  app.use('/api/projects', projectStatusRouter);
  app.use('/api', projectsGlobalDistributionRouter);

  app.use('/api/hgnHelp', communityRouter());
  app.use('/api/costs', costsRouter);
  app.use('/api', hoursPledgedRoutes);
  app.use('/api', templateRouter);
  app.use('/api', emailTemplateRouter);

  app.use('/api/help-categories', helpCategoryRouter);
  app.use('/api', tagRouter);
  app.use('/api/education-tasks', educationTaskRouter);
  app.use('/api/educator', educatorRouter);
  app.use('/api/atoms', atomRouter);
  app.use('/api/intermediate-tasks', intermediateTaskRouter);
  app.use('/api/analytics', pledgeAnalyticsRoutes);
  app.use('/api', registrationRouter);

  app.use('/api/job-analytics', jobAnalyticsRoutes);
  app.use('/api/applicant-volunteer-ratio', applicantVolunteerRatioRouter);

  app.use('/job-analytics', jobAnalyticsRouter);
  app.use('/api', weeklySummariesFilterRouter);
  app.use('/api/popularity', popularityTimelineRoutes);
  app.use('/applications', applicationRoutes);
  app.use('/api/popularity-enhanced', popularityEnhancedRoutes);

  // bm dashboard
  app.use('/api/bm', bmLoginRouter);
  app.use('/api/bm', bmMaterialsRouter);
  app.use('/api/bm', bmReusableRouter);
  app.use('/api/bm', bmProjectRouter);
  app.use('/api/bm', bmNewLessonRouter);
  app.use('/api/bm', bmInventoryTypeRouter);
  app.use('/api/bm', bmToolsReturnedLateRouter);
  app.use('/api/bm', bmToolRouter);
  app.use('/api/bm', bmEquipmentRouter);
  app.use('/api/bm', bmConsumablesRouter);
  app.use('/api/bm', bmUpdateHistoryRouter);
  app.use('/api/dropbox', dropboxRouter);
  app.use('/api/github', githubRouter);
  app.use('/api/sentry', sentryRouter);
  app.use('/api/slack', slackRouter);
  app.use('/api/accessManagement', appAccessRouter);
  app.use('/api/bm', bmExternalTeam);
  app.use('/api', toolAvailabilityRouter);
  app.use('/api', toolUtilizationRouter);
  // lb dashboard


  app.use('/api', toolAvailabilityRouter);
  app.use('/api', projectCostTrackingRouter);

  app.use('/api/bm', bmIssueRouter);
  app.use('/api/bm', bmDashboardRouter);
  app.use('/api/bm', bmActualVsPlannedCostRouter);
  app.use('/api/bm', bmTimeLoggerRouter);
  app.use('/api/bm/injuries', injuryCategoryRoutes);
  app.use('/api', toolAvailabilityRouter);
  app.use('/api', projectCostTrackingRouter);
  app.use('/api/bm', bmIssueRouter);
  app.use('/api/labor-cost', bmPaidLaborCostRouter);
  app.use('/api/bm', bmInjuryRouter);
  app.use('/api', bmProjectRiskProfileRouter);

  app.use('/api/lb', bidPropertyRouter);
  app.use('/api/lb', userBidRouter);

  //community portal
  app.use('/api/communityportal/reports/participation', cpNoShowRouter);
  app.use('/api/communityportal/activities/', cpEventFeedbackRouter);
  app.use('/api/resourceManagement', resourceManagementRouter);

  // lb dashboard
  app.use('/api/lb', lbListingsRouter);
  app.use('/api/bm', bmIssueRouter);
  app.use('/api', eventRouter);
  app.use('/api/villages', require('../routes/lbdashboard/villages'));
  app.use('/api/lb', lbMessageRouter);
  app.use('/api/lb', lbUserPrefRouter);

  app.use('/api/financials', bmFinancialRouter);
  app.use('/api/lbdashboard/bookings', bookingRouter);

  app.use('/api/lb', biddingRouter);
  app.use('/api', registrationRouter);
  app.use('/api', projectMaterialRouter);
  app.use('/api', plannedCostRouter(plannedCost, project));

  // summary dashboard
  app.use('/api/suppliers', supplierPerformanceRouter);
  app.use('/api/labor-hours', laborHoursDistributionRouter);
  app.use('/api/', projectCostRouter);
  app.use('/api', toolAvailabilityRoutes);
  app.use('/api', projectMaterialRouter);
  app.use('/api/bm', bmRentalChart);
  app.use('/api', bmToolsDowntimeRouter);
  app.use('/api/lb', lbWishlistsRouter);
  app.use('/api', actualCostRouter);

  app.use('/api', promotionDetailsRouter);
  app.use('/api/analytics', analyticsPopularPRsRouter);
  app.use('/api/', promotionEligibilityRouter(userProfile, timeEntry, task, PromotionEligibility));

  // PR Analytics
  app.use('/api', prInsightsRouter);
  app.use('/api', weeklyGradingRouter);
  app.use('/api', projectMaterialRouter);
  app.use('/api/bm', bmRentalChart);
  app.use('/api/lb', lbWishlistsRouter);

  // Education Portal
  app.use('/api/student/profile', educationProfileRouter);

  app.use('/api', materialCostRouter);

  app.use('/api/lp', lessonPlanSubmissionRouter);
};
