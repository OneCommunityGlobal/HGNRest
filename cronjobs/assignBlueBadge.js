var schedule = require('node-schedule-tz');
const CronJob = require('cron').CronJob;
const userhelper = require("../helpers/userhelper")();
const email = require("../helpers/email");



var assignBlueBadge = function(){

   
    var job = new CronJob(
       cronTime= '1 0 * * 1',onTick= userhelper.assignBlueBadgeforTimeNotMet,onComplete = email, start = false, timezone= 'America/Los_Angeles');
    console.log(job.nextDates())
    job.start()
}


module.exports = assignBlueBadge;
