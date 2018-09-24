var userProfile = require('../models/userProfile');
var myteam = require('../helpers/helperModels/myTeam');
var dashboardhelper = require("../helpers/dashboardhelper")()
var mongoose = require('mongoose');
var moment = require('moment-timezone');

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

    var assignBlueBadgeforTimeNotMet = function(){
        console.log("trigger job")
        var pdtStartOfLastWeek = moment().tz("America/Los_Angeles").startOf("isoWeek").subtract(1, "week");
        var pdtEndOfLastWeek = moment().tz("America/Los_Angeles").endOf("isoWeek").subtract(1, "week");
        userProfile.find({ isActive: true}, '_id')
        .then(users => {
            users.forEach(user => {
                const personId = mongoose.Types.ObjectId(user._id)
                dashboardhelper.laborthisweek(personId, pdtStartOfLastWeek, pdtEndOfLastWeek)
        .then(results => {
            const weeklyComittedHours = results[0].weeklyComittedHours;
            const timeSpent = results[0].timeSpent_hrs;
            console.log(`Checking for user ${user._id} committed : ${weeklyComittedHours} logged : ${timeSpent}`)
            
            if (timeSpent < weeklyComittedHours)
            {
                const description = `System auto-assigned infringement for not meeting weekly volunteer time commitment. You logged ${timeSpent} hours against committed effort of ${weeklyComittedHours} hours in the week starting ${pdtStartOfLastWeek.format("dddd YYYY-MM-DD")} and ending ${pdtEndOfLastWeek.format("dddd YYYY-MM-DD")}`
                const infringment = {date: moment().utc().format("YYYY-MM-DD"), description :description }
                userProfile.findByIdAndUpdate(personId,{$push: {infringments: infringment}} )
                .then(status => console.log(`Assigned infringment to ${status._id} ${status.firstName} ${status.lastName}`))
                .catch(error  => console.log(error))
            }
        })
        .catch(error => console.log(error))
            });    

        })
        .catch(error => console.log(error))
    }

    return {

        getUserName: getUserName,
        getTeamMembers: getTeamMembers,
        validateprofilepic : validateprofilepic,
        assignBlueBadgeforTimeNotMet: assignBlueBadgeforTimeNotMet

    }

}

module.exports = userhelper;
