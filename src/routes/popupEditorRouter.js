const express = require('express');


const routes = function (popupEditor) {
  const controller = require('../controllers/popupEditorController')(popupEditor);
  const popupEditorRouter = express.Router();

  popupEditorRouter.route('/popupeditors/')
    .get(controller.getAllPopupEditors)
    .post(controller.createPopupEditor);

  popupEditorRouter.route('/popupeditor/:id')
    .post(controller.updatePopupEditor)
    .get(controller.getPopupEditorById);

  return popupEditorRouter;
};

module.exports = routes;
