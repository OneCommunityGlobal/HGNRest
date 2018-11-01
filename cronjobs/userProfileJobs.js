const CronJob = require('cron').CronJob;
const userhelper = require("../helpers/userhelper")();


var userProfileScheduledJobs = function(){
   
var assignBlueBadge = new CronJob(
       cronTime= '0 0 * * 1',
       onTick= userhelper.assignBlueBadgeforTimeNotMet, 
       onComplete = null,
       start = false, 
       timeZone= 'America/Los_Angeles');
   
var deleteBlueBadgeOlderThanYear = new CronJob(
    cronTime= '45 11 * * *',
    onTick= userhelper.deleteBadgeAfterYear, 
    onComplete = null,
    start = false, 
    timeZone= 'America/Los_Angeles');
 

assignBlueBadge.start()
deleteBlueBadgeOlderThanYear.start()
 
}




module.exports = userProfileScheduledJobs;
