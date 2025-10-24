const express = require('express');
const router = express.Router();

const {
  getEducators,
  getEducatorById,
  getStudentsByEducator,
  getSubjects,
  searchStudentsAcrossEducators,
} = require('../controllers/pmeducatorsController');

const {
  previewNotification,
  sendNotification,
} = require('../controllers/pmnotificationsController');

router.get('/educators', getEducators);                       
router.get('/educators/:educatorId', getEducatorById);        
router.get('/educators/:educatorId/students', getStudentsByEducator); 

router.get('/subjects', getSubjects);                         
router.get('/students/search', searchStudentsAcrossEducators);

router.post('/notifications/preview', previewNotification);   
router.post('/notifications', sendNotification);              

module.exports = router;
