const express = require('express');

const router = express.Router();
const ctrl = require('../controllers/educatorGroupController');

const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.body.requestor || !roles.includes(req.body.requestor.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role privileges' });
    }
    next();
  };

router.post('/groups', authorizeRoles('Educator', 'Manager', 'Administrator'), ctrl.createGroup);
router.get('/groups', ctrl.getGroups);
router.put('/groups/:groupId', ctrl.updateGroup);
router.delete('/groups/:groupId', ctrl.deleteGroup);

router.get('/groups/:groupId/members', ctrl.getGroupMembers);
router.post('/groups/:groupId/members', ctrl.addMembers);
router.delete('/groups/:groupId/members', ctrl.removeMembers);

router.get('/students', ctrl.getAllStudents);

module.exports = router;
