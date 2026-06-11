const { Router } = require('express');
const { getTrends, getSummary } = require('../controllers/tasksWeeklyController');

const router = Router();
router.get('/tasks/trends', getTrends);

router.get('/tasks/summary', getSummary);

module.exports = router;
