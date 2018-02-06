var userProfile = require('../models/userProfile');
var mongoose = require('mongoose');

var userhelper = function(){

    var isUserManagerof = function(userId, managerId){

        return true;

    } 

    var getUserName = async function(userId)
    {
        let userid = mongoose.Types.ObjectId(userId);
        let user = await userProfile.findById(userid, 'firstName lastName -_id')
       

        return user.firstName+ user.lastName;

    }

    return{
        isUserManagerof : isUserManagerof,
        getUserName: getUserName

    }

}

module.exports = userhelper;