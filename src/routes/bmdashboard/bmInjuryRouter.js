const express = require('express');

const requireInjuryManager = (req, res, next) => {
  const allowedRoles = ['Owner', 'Administrator'];

  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions.',
    });
  }

  return next();
};

const routes = function (injurySeverity) {
  const injuryRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInjuryController')(injurySeverity);

  injuryRouter.post('/injuries', requireInjuryManager, controller.postInjury);

  injuryRouter.get('/injuries/severity-by-project', controller.getInjuries);

  return injuryRouter;
};

module.exports = routes;
