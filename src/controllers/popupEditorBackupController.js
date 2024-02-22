const { hasPermission } = require('../utilities/permissions');

const popupEditorBackupController = function (PopupEditorBackups) {
  const getAllPopupEditorBackups = function (req, res) {
    PopupEditorBackups.find()
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  const getPopupEditorBackupById = function (req, res) {
    const popupId = req.params.id;
    try {
      PopupEditorBackups.find({ popupId: { $in: popupId } }, (error, popupBackup) => {
        res.status(200).send(popupBackup[0]);
      });
    } catch (error) {
      res.status(404).send(error);
    }
  };

  const createPopupEditorBackup = async function (req, res) {
    if (!await hasPermission(req.body.requestor, 'createPopup')) {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new popup' });
      return;
    }

    if (!req.body.popupName || !req.body.popupContent) {
      res.status(400).send({
        error: 'popupName , popupContent are mandatory fields',
      });
      return;
    }

    const popup = new PopupEditorBackups();
    popup.popupId = req.body.popupId;
    popup.popupName = req.body.popupName;
    popup.popupContent = req.body.popupContent;

    popup.save()
      .then((results) => res.status(201).send(results))
      .catch((error) => res.status(500).send({ error }));
  };

  const updatePopupEditorBackup = async function (req, res) {
    if (!await hasPermission(req.body.requestor, 'updatePopup')) {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new popup' });
      return;
    }

    if (!req.body.popupContent) {
      res.status(400).send({
        error: 'popupContent is mandatory field',
      });
      return;
    }

    const popupId = req.params.id;

    try {
      PopupEditorBackups.find({ popupId: { $in: popupId } }, (error, popupBackup) => {
        if (popupBackup.length > 0) {
          popupBackup[0].popupContent = req.body.popupContent;
          popupBackup[0].save().then((results) => res.status(201).send(results));
        } else {
          const popup = new PopupEditorBackups();
          popup.popupId = req.params.id;
          popup.popupContent = req.body.popupContent;
          popup.popupName = req.body.popupName;
          popup.save()
            .then((results) => res.status(201).send(results))
            .catch((err) => res.status(500).send({ err }));
        }
      });
    } catch (error) {
      res.status(500).send({ error });
    }
  };

  return {
    createPopupEditorBackup,
    getAllPopupEditorBackups,
    updatePopupEditorBackup,
    getPopupEditorBackupById,
  };
};

module.exports = popupEditorBackupController;
