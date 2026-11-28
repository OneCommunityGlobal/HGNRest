const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const UserProfile = require('../../models/userProfile');

const authorizePayRateUpdate = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    const expiryTime = new Date(decoded.expiryTimestamp).getTime();

    if (!decoded.userid || !Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const user = await UserProfile.findById(decoded.userid).select('role isActive');

    if (!user || !user.isActive) {
      return res.status(403).json({
        message: 'Account is inactive or unavailable.',
      });
    }

    if (!['Owner', 'Administrator'].includes(user.role)) {
      return res.status(403).json({
        message: 'Insufficient permissions.',
      });
    }

    req.user = { userid: decoded.userid, role: user.role };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid authentication token.' });
  }
};
const routes = function (buildingProject) {
  const projectRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectController')(buildingProject);

  projectRouter.route('/projects').get(controller.fetchAllProjects);

  projectRouter.route('/project/:projectId').get(controller.fetchSingleProject);

  projectRouter.route('/projectsNames').get(controller.fetchProjectsNames);

  projectRouter.route('/project/:projectId/users').get(controller.fetchProjectMembers);
  projectRouter
    .route('/project/:projectId/hourly-rates')
    .get(authorizePayRateUpdate, controller.fetchProjectHourlyRates);

  projectRouter
    .route('/project/:projectId/users/:memberId/hourly-rate')
    .put(authorizePayRateUpdate, controller.updateMemberHourlyRate);

  projectRouter
    .route('/project/:projectId/tasks/labor-budget')
    .put(authorizePayRateUpdate, controller.updateTaskLaborBudget);

  return projectRouter;
};

module.exports = routes;
