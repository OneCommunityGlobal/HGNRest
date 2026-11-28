const express = require('express');
const { bmEquipmentStatusUpload } = require('../../middleware/bmEquipmentStatusUpload');
const {
  equipmentAttachments,
  receiveAttachment,
} = require('../../controllers/bmdashboard/bmEquipmentAttachments');
const equipmentRecords = require('../../controllers/bmdashboard/bmEquipmentRecords');

function requireBMPortal(req, res, next) {
  if (!req.user?.access?.canAccessBMPortal) {
    return res
      .status(403)
      .json({ message: 'Sign in to the building management portal to continue.' });
  }
  return next();
}

function requireEquipmentEditor(req, res, next) {
  if (!['Owner', 'Administrator', 'Manager'].includes(req.user?.role)) {
    return res
      .status(403)
      .json({ message: 'Your role has view-only access to equipment history and files.' });
  }
  return next();
}

const routes = function (BuildingEquipment) {
  const equipmentRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmEquipmentController')(
    BuildingEquipment,
  );
  const attachments = equipmentAttachments(BuildingEquipment);
  const saveRecord = equipmentRecords(BuildingEquipment);

  equipmentRouter.post(
    '/equipment/:equipmentId/records/:kind',
    requireBMPortal,
    requireEquipmentEditor,
    saveRecord,
  );
  equipmentRouter.patch(
    '/equipment/:equipmentId/records/:kind/:index',
    requireBMPortal,
    requireEquipmentEditor,
    saveRecord,
  );
  equipmentRouter
    .route('/equipment/:equipmentId/attachments')
    .get(requireBMPortal, attachments.list)
    .post(requireBMPortal, requireEquipmentEditor, receiveAttachment, attachments.add);
  equipmentRouter
    .route('/equipment/:equipmentId/attachments/:attachmentId')
    .get(requireBMPortal, attachments.download)
    .patch(requireBMPortal, requireEquipmentEditor, attachments.edit)
    .delete(requireBMPortal, requireEquipmentEditor, attachments.remove);

  equipmentRouter
    .route('/equipment/:equipmentId')
    .get(controller.fetchSingleEquipment)
    .put(requireBMPortal, requireEquipmentEditor, controller.updateEquipmentById);

  equipmentRouter
    .route('/equipment/:equipmentId/status')
    .put(bmEquipmentStatusUpload, controller.updateEquipmentStatus);

  equipmentRouter.route('/equipment/purchase').post(controller.bmPurchaseEquipments);

  equipmentRouter.route('/equipments').get(controller.fetchBMEquipments);

  equipmentRouter.route('/equipments/logRecords').put(controller.updateLogRecords);

  return equipmentRouter;
};

module.exports = routes;
