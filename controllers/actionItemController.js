var mongoose = require('mongoose');
var notification = require('../models/notification');
var notificationsController = require('../controllers/notificationController')(notification);

let userhelper = require('../helpers/userhelper')();

let actionItemController = function (actionItem) {
  let getactionItem = function (req, res) {

    let userid = req.params.userId;
    actionItem.find({
        assignedTo: userid
      }, ('-createdDateTime -__v' ))
      .populate('createdBy', 'firstName lastName')
      .then(results => {
        let actionitems = [];

        results.forEach(element => {

         let name = (element.assignedTo === element.createdBy._id) ? "Self" : `${element.createdBy.firstName} ${element.createdBy.lastName}`;
         let actionitem = {};

         actionitem._id = element._id;
         actionitem.description = element.description;
         actionitem.createdBy = name;
         actionitem.assignedTo = element.assignedTo;

         actionitems.push(actionitem);
          
        });

          res.status(200).send(actionitems);
      })
      .catch(error => {
        res.status(400).send("badd!!!")
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

        notificationsController.createUserNotification("created",_actionItem.description, _actionItem.assignedTo);

        if(requestorId != assignedTo)
        {
           
            notificationsController.createUserNotification("created",_actionItem.description, _actionItem.requestorId);
        }

        let result = {};

        if(results.createdBy.toString() === results.assignedTo.toString())
        {
          
          result.name = "Self";
          result.description = results.description;
          result._id= results._id;
          result.assignedTo = results.assignedTo
        }



        res.status(200).send(result)
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

  let editactionItem = async function(req, res)
  {
    let actionItemId = mongoose.Types.ObjectId(req.params.actionItemId);    

    let _actionItem = await actionItem.findById(actionItemId)
      .catch(error => {
        res.status(400).send(error);
        return;
      })

    if (!_actionItem) {
      res.status(400).send({"message": "No valid records found"});
    return;
    };
    _actionItem.description = req.body.description;
    _actionItem.assignedTo = req.body.assignedTo;

    _actionItem.save()
    .then(res.status(200).send("Saved"))
    .catch(error => res.status(400).send(error));

  }


  return {
    getactionItem: getactionItem,
    postactionItem: postactionItem,
    deleteactionItem: deleteactionItem,
    editactionItem:editactionItem

  }
};

module.exports = actionItemController;
