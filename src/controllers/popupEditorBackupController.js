const popupEditorBackupController = function (PopupEditorBackups) {
  const getAllPopupEditorBackups = function (req, res) {
    PopupEditorBackups.find()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
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


  const createPopupEditorBackup = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
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
      .then(results => res.status(201).send(results))
      .catch(error => res.status(500).send({ error }));
  };

  const updatePopupEditorBackup = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
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
        popupBackup[0].popupContent = req.body.popupContent;
        popupBackup[0].save().then(results => res.status(201).send(results));
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
