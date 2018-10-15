const CronJob = require('cron').CronJob;
const userhelper = require("../helpers/userhelper")();
const email = require("../helpers/email");


var userProfileScheduledJobs = function(){
   
var assignBlueBadge = new CronJob(
       cronTime= '25 14 * * *',onTick= userhelper.assignBlueBadgeforTimeNotMet,onComplete = email, start = false, timezone= 'America/Los_Angeles');
   
var deleteBlueBadgeOlderThanYear = new CronJob(
    cronTime= '0 0 * * *',onTick= userhelper.deleteBadgeAfterYear,onComplete = email, start = false, timezone= 'America/Los_Angeles');
 

assignBlueBadge.start()
deleteBlueBadgeOlderThanYear.start()
 
}




module.exports = userProfileScheduledJobs;
