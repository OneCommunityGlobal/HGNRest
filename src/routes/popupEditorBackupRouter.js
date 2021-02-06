const express = require('express');


const routes = function (popupEditorBackup) {
  const controller = require('../controllers/popupEditorBackupController')(popupEditorBackup);
  const popupEditorBackupRouter = express.Router();

  popupEditorBackupRouter.route('/backup/popupeditors/')
    .get(controller.getAllPopupEditorBackups)
    .post(controller.createPopupEditorBackup);

  popupEditorBackupRouter.route('/backup/popupeditor/:id')
    .post(controller.updatePopupEditorBackup)
    .get(controller.getPopupEditorBackupById);

  return popupEditorBackupRouter;
};

module.exports = routes;
