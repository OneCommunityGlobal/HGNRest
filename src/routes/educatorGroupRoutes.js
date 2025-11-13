const express = require('express');

const router = express.Router();
const ctrl = require('../controllers/educatorGroupController');

// CRUD
router.post('/groups', ctrl.createGroup);
router.get('/groups', ctrl.getGroups);
router.get('/groups/:groupId/members', ctrl.getGroupMembers);
router.put('/groups/:groupId', ctrl.updateGroup);
router.delete('/groups/:groupId', ctrl.deleteGroup);
router.get('/students', ctrl.getAllStudents);

module.exports = router;
