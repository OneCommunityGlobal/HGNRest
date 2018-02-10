var userProfile = require('../models/userProfile');
var mongoose = require('mongoose');

var userhelper = function(){

    var isUserManagerof = function(userId, managerId){

        return true;

    } ;
    var getTeamMembers = function (userdetails) {

        var teamid = userdetails.teamId;
        return userProfile
          .find({
            $and: [{
              teamId: {
                $in: teamid
              }
            }, {
              isActive: true
            }]
          })
          .select({
            _id: 1,
            firstName: 1,
            lastName: 1,
            role:1
          });
        };

    

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