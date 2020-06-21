const mongoose = require('mongoose');
const notificationhelper = require('../helpers/notificationhelper')();

const actionItemController = function (ActionItem) {
  const getactionItem = function (req, res) {
    const userid = req.params.userId;
    ActionItem.find({
      assignedTo: userid,
    }, ('-createdDateTime -__v'))
      .populate('createdBy', 'firstName lastName')
      .then((results) => {
        const actionitems = [];

        results.forEach((element) => {
          const actionitem = {};

          actionitem._id = element._id;
          actionitem.description = element.description;
          actionitem.createdBy = `${element.createdBy.firstName} ${element.createdBy.lastName}`;
          actionitem.assignedTo = element.assignedTo;

          actionitems.push(actionitem);
        });

        res.status(200).send(actionitems);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };
  const postactionItem = function (req, res) {
    const { requestorId, assignedTo } = req.body.requestor;
    const _actionItem = new ActionItem();

    _actionItem.description = req.body.description;
    _actionItem.assignedTo = req.body.assignedTo;
    _actionItem.createdBy = req.body.requestor.requestorId;


    _actionItem.save()
      .then((result) => {
        notificationhelper.notificationcreated(requestorId, assignedTo, _actionItem.description);

        const actionitem = {};

        actionitem.createdBy = 'You';
        actionitem.description = _actionItem.description;
        actionitem._id = result._id;
        actionitem.assignedTo = _actionItem.assignedTo;

        res.status(200).send(actionitem);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const deleteactionItem = async function (req, res) {
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

    notificationhelper.notificationdeleted(requestorId, assignedTo, _actionItem.description);

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

  const editactionItem = async function (req, res) {
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
    notificationhelper.notificationedited(requestorId, assignedTo, _actionItem.description, req.body.description);

    _actionItem.description = req.body.description;
    _actionItem.assignedTo = req.body.assignedTo;

    _actionItem.save()
      .then(res.status(200).send('Saved'))
      .catch(error => res.status(400).send(error));
  };


  return {
    getactionItem,
    postactionItem,
    deleteactionItem,
    editactionItem,

  };
};

module.exports = actionItemController;
