var userProfile = require('../models/userProfile');
var myteam = require('../helpers/helperModels/myTeam');
var mongoose = require('mongoose');

var userhelper = function () {


    var getTeamMembers = function (user) {

        var userid = mongoose.Types.ObjectId(user._id);
        // var teamid = userdetails.teamId;
        return myteam.findById(userid).select({ "myteam._id": 1, "myteam.role": 1, "myteam.fullName": 1, _id: 0 });
    }


    var getUserName = async function (userId) {
        let userid = mongoose.Types.ObjectId(userId);
        return userProfile.findById(userid, 'firstName lastName');
    }

    var validateprofilepic = function(profilePic)
    {
        let pic_parts = profilePic.split("base64");
        let result =true;
        let errors = [];
        
        if (pic_parts.length <2 )
        {return ( {"result": false, "errors": "Invalid image"});}

        //validate size
        let imagesize = pic_parts[1].length;
        var sizeInBytes = 4 * Math.ceil(imagesize / 3) * 0.5624896334383812 / 1024;

        if (sizeInBytes > 50) {
         errors.push("Image size should not exceed 50KB" );
         result = false;
          return;
        }

        let imagetype = pic_parts[0].split("/")[1];
        if (imagetype != "jpeg;" && imagetype != "png;") {
          errors.push("Image type shoud be either jpeg or png." );
          result = false;
          return;
        }

        return ( {"result": result, "errors": errors});
       
    }

    return {

        getUserName: getUserName,
        getTeamMembers: getTeamMembers,
        validateprofilepic : validateprofilepic

    }

}

module.exports = userhelper;
