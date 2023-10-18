const express = require('express');

const routes = function (rolePreset) {
  const controller = require('../controllers/rolePresetsController')(rolePreset);
  const PresetsRouter = express.Router();

  PresetsRouter.route('/rolePreset')
  .post(controller.createNewPreset);

  PresetsRouter.route('/rolePreset/:roleName')
  .get(controller.getPresetsByRole);

  PresetsRouter.route('/rolePreset/:presetId')
  .put(controller.updatePresetById)
  .delete(controller.deletePresetById);

return PresetsRouter;
};

module.exports = routes;
