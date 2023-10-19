const { hasPermission } = require('../utilities/permissions');

const popupEditorController = function (PopupEditors) {
  const getAllPopupEditors = function (req, res) {
    PopupEditors.find()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const getPopupEditorById = function (req, res) {
    PopupEditors.findById(req.params.id)
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };


  const createPopupEditor = async function (req, res) {
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
    const popup = new PopupEditors();
    popup.popupName = req.body.popupName;
    popup.popupContent = req.body.popupContent;

    popup.save()
      .then(results => res.status(201).send(results))
      .catch(error => res.status(500).send({ error }));
  };

  const updatePopupEditor = async function (req, res) {
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

    PopupEditors.findById(popupId, (error, popup) => {
      popup.popupContent = req.body.popupContent;
      popup.save().then(results => res.status(201).send(results))
        .catch(err => res.status(500).send({ err }));
    });
  };


  return {
    createPopupEditor,
    getAllPopupEditors,
    updatePopupEditor,
    getPopupEditorById,
  };
};


module.exports = popupEditorController;
