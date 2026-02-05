const express = require('express');
const bmWorkforceSkillGapController = require('../../controllers/bmdashboard/bmWorkforceSkillGapController');

const workforceSkillGapRouter = function () {
  const router = express.Router();
  const controller = bmWorkforceSkillGapController();

  router.route('/skillGap').get(controller.getWorkforceSkillGap);

  return router;
};

module.exports = workforceSkillGapRouter;
