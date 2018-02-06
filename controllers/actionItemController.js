var mongoose = require('mongoose');
var notification = require('../models/notification');
var notificationsController = require('../controllers/notificationController')(notification);

let userhelper = require('../helpers/userhelper')();

let actionItemController = function (actionItem) {
  let getactionItem = function (req, res) {

    let userid = req.params.userId;
    actionItem.find({
        assignedTo: userid
      })
      .then(results => {
        res.status(200).send(results)
      })
      .catch(error => {
        res.status(400).send(error)
      });


  };
  let postactionItem = function (req, res) {

    let requestorId = req.body.requestor.requestorId;
    let assignedTo = req.body.assignedTo;
   
    //Verify is requestor is assignee himself or requestor is his manager

    let isUserAuthroized = (requestorId === assignedTo || userhelper.isUserManagerof(assignedTo, requestorId)) ? true : false;

   


    if (!isUserAuthroized) {
      res.status(403).send("You are not authorized to create action items for this user");
      return;
    }

    let _actionItem = new actionItem();

    _actionItem.description = req.body.description;
    _actionItem.assignedTo = req.body.assignedTo;
    _actionItem.createdBy = req.body.requestor.requestorId;

    

    _actionItem.save()
      .then(results => {

        if(requestorId != assignedTo)
        {
           
            notificationsController.createUserNotification("created",_actionItem.description, _actionItem.assignedTo);
        }

        res.status(200).send(results._id)
      })
      .catch(error => {
        console.log(error);
        res.status(400).send(error)
      });
  };

  let deleteactionItem = async function (req, res) {
    let actionItemId = mongoose.Types.ObjectId(req.params.actionItemId);

    

    let _actionItem = await actionItem.findById(actionItemId)
      .catch(error => {
        res.status(400).send(error);
        return;
      })

    if (!_actionItem) {
      res.status(400).send({
        "message": "No valid records found"
      });
      return;
    }

    let requestorId = req.body.requestor.requestorId;
    let assignedTo = _actionItem.assignedTo;

    //Verify is requestor is assignee himself or requestor is his manager

    let isUserAuthroized = (requestorId === assignedTo || userhelper.isUserManagerof(assignedTo, requestorId)) ? true : false;

    if (!isUserAuthroized) {
      res.status(403).send("You are not authorized to delete action items for this user");
      return;
    }

    if(requestorId != assignedTo)
    {
        
        notificationsController.createUserNotification("deleted",_actionItem.description, _actionItem.assignedTo);
    }

    _actionItem.remove()
      .then(results => {
      
        res.status(200).send({ "message": "removed"}) ;
    }
    )
      .catch(error => {
        res.status(400).send(error)
      });
  };

  return {
    getactionItem: getactionItem,
    postactionItem: postactionItem,
    deleteactionItem: deleteactionItem

  }
};

module.exports = actionItemController;
