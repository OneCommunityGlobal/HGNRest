const mongoose = require('mongoose');
const notificationHelper = require('../helpers/notificationHelper')();

const actionItemController = function (ActionItem) {
  const getActionItem = function (req, res) {
    const id = req.params.userId;
    ActionItem.find({
      assignedTo: id,
    }, ('-createdDateTime -__v'))
      .populate('createdBy', 'firstName lastName')
      .then((results) => {
        const actItems = [];

        results.forEach((element) => {
          const actItem = {};

          actItem._id = element._id;
          actItem.description = element.description;
          actItem.createdBy = `${element.createdBy.firstName} ${element.createdBy.lastName}`;
          actItem.assignedTo = element.assignedTo;

          actItems.push(actItem);
        });

        res.status(200).send(actItems);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };
  const postActionItem = function (req, res) {
    const { requestorId, assignedTo } = req.body.requestor;
    const _actionItem = new ActionItem();

    _actionItem.description = req.body.description;
    _actionItem.assignedTo = req.body.assignedTo;
    _actionItem.createdBy = req.body.requestor.requestorId;


    _actionItem.save()
      .then((result) => {
        notificationHelper.notificationCreated(requestorId, assignedTo, _actionItem.description);

        const actItem = {};

        actItem.createdBy = 'You';
        actItem.description = _actionItem.description;
        actItem._id = result._id;
        actItem.assignedTo = _actionItem.assignedTo;

        res.status(200).send(actItem);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const deleteActionItem = async function (req, res) {
    const actionItemId = mongoose.Types.ObjectId(req.params.actionItemId);


    const _actionItem = await ActionItem.findById(actionItemId)
      .catch((error) => {
        res.status(400).send(error);
      });

    if (!_actionItem) {
      res.status(400).send({
        message: 'No valid records found',
      });
      return;
    }

    const { requestorId, assignedTo } = req.body.requestor;

    notificationHelper.notificationDeleted(requestorId, assignedTo, _actionItem.description);

    _actionItem.remove()
      .then(() => {
        res.status(200).send({
          message: 'removed',
        });
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const editActionItem = async function (req, res) {
    const actionItemId = mongoose.Types.ObjectId(req.params.actionItemId);

    const { requestorId, assignedTo } = req.body.requestor;

    const _actionItem = await ActionItem.findById(actionItemId)
      .catch((error) => {
        res.status(400).send(error);
      });

    if (!_actionItem) {
      res.status(400).send({
        message: 'No valid records found',
      });
      return;
    }
    notificationHelper.notificationEdited(requestorId, assignedTo, _actionItem.description, req.body.description);

    _actionItem.description = req.body.description;
    _actionItem.assignedTo = req.body.assignedTo;

    _actionItem.save()
      .then(res.status(200).send('Saved'))
      .catch(error => res.status(400).send(error));
  };


  return {
    getActionItem,
    postActionItem,
    deleteActionItem,
    editActionItem,

  };
};

module.exports = actionItemController;
