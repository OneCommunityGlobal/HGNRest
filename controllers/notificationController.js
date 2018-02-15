var mongoose = require('mongoose');
var notificationController = function(notification){

    var getUserNotifications = function(req, res){

        var userid = req.params.userId;
        //verify requestor is same as userId

        if(req.body.requestor.requestorId != userid)
        {
            res.status(403).send("Unauthroized request");
            return;
        }
        userid = mongoose.Types.ObjectId(userid)

        notification.find({recipient :userid }, '_id message eventType')
        .then(results => {res.status(200).send(results)})
        .catch(errors => {res.status(400).send(error)});


    };

    var createUserNotification = function(notification){

        notification.save()
        .then(results => {console.log(` notification created with id ${results._id}`)})
        .catch(error => {console.log(error)});

    }

    var deleteUserNotification = function(req, res){

        let notificationId = mongoose.Types.ObjectId(req.params.notificationId);

        notification.findById(notificationId)
        .then(result => {
            //verify is requestor same as assignee
            if(req.body.requestor.requestorId != result.recipient)
        {
            res.status(403).send("Unauthroized request");
            return;
        }
        result.remove()
        .then(res.status(200).send("Removed"))
        .catch(errors => {res.status(400).send(error)});
        })
        .catch(errors => {res.status(400).send(error)});

        
    }


    return{
        getUserNotifications: getUserNotifications,
        deleteUserNotification: deleteUserNotification,
        createUserNotification : createUserNotification
    }
};

module.exports = notificationController;