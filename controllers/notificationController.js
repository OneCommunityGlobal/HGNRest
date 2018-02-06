var notificationController = function(notification){

    var getUserNotifications = function(){


    }

    var createUserNotification = function(action, description, recipient){

        var _notification = new notification();

        _notification.message = `Action item ${description} was ${action} for you `;
        _notification.recipient = recipient;
        _notification.eventType = ( action == "created"? "Action Assigned" : "Action Removed");

        _notification.save()
        .then(results => {console.log(` notification created with id ${results._id}`)})
        .catch(error => {console.log(error)});

    }

    var putUserNotification = function(){}


    return{
        getUserNotifications: getUserNotifications,
        putUserNotification: putUserNotification,
        createUserNotification : createUserNotification
    }
};

module.exports = notificationController;