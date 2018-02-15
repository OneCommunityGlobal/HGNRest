var userProfile = require('../models/userProfile');
var myteam = require('../helpers/helperModels/myTeam');
var mongoose = require('mongoose');

var userhelper = function(){

    var isUserManagerof = function(userId, managerId){

        return true;

    } ;
    var getTeamMembers = function (user) {

      var userid =mongoose.Types.ObjectId(user._id );        
     // var teamid = userdetails.teamId;
    return myteam.findById(userid).select ({"myteam._id":1,"myteam.role":1, "myteam.fullName":1, _id:0 });
   


    }

    
    var getUserName =  async function(userId)
    {
        let userid = mongoose.Types.ObjectId(userId);
      return userProfile.findById(userid, 'firstName lastName');
        
       
       
        
    }

    return{
        isUserManagerof : isUserManagerof,
        getUserName: getUserName,
        getTeamMembers: getTeamMembers,

    }

}

module.exports = userhelper;