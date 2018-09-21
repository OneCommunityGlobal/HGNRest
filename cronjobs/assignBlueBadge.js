var schedule = require('node-schedule-tz');
var moment = require('moment-timezone');
var dashboardhelper = require("../helpers/dashboardhelper")()
let mongoose = require('mongoose');
var userProfile = require('../models/userProfile');

//Set the job trigger time as end of iso week day.
var pdtStartOfLastWeek = moment().tz("America/Los_Angeles").startOf("isoWeek").subtract(1, "week");
var pdtEndOfLastWeek = moment().tz("America/Los_Angeles").endOf("isoWeek").subtract(1, "week");

var eligibleForInfringmentRoles = ['Volunteer', 'Manager', 'Administrator', 'Core Team']

var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = 5; // 0-6 for Sunday - Saturday
rule.hour = 0;
rule.minute = 0;
rule.second = 1;
rule.tz = "America/Los_Angeles";


var assignBlueBadge = function(userProfile){
    schedule.scheduleJob(rule, function(){
        console.log("trigger job")
        userProfile.find({role: {$in: eligibleForInfringmentRoles}, isActive: true}, '_id')
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
                const description = `Sample run inititated at ${moment().tz("America/Los_Angeles").format()}. System auto-assigned infringement for not meeting weekly volunteer time commitment. You logged ${timeSpent} hours against committed effort of ${weeklyComittedHours} hours in the week starting ${pdtStartOfLastWeek.format("dddd YYYY-MM-DD")} and ending ${pdtEndOfLastWeek.format("dddd YYYY-MM-DD")}`
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

        
    
});
}


module.exports = assignBlueBadge;
