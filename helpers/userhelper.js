var userProfile = require('../models/userProfile');
var myteam = require('../helpers/helperModels/myTeam');
var dashboardhelper = require("../helpers/dashboardhelper")()
var mongoose = require('mongoose');
var moment = require('moment-timezone');
var emailSender = require("../utilities/emailSender");
var _ = require("lodash")
const logger = require("../startup/logger");

var userhelper = function () {


  var getTeamMembers = function (user) {

    var userid = mongoose.Types.ObjectId(user._id);
    // var teamid = userdetails.teamId;
    return myteam.findById(userid).select({
      "myteam._id": 1,
      "myteam.role": 1,
      "myteam.fullName": 1,
      _id: 0
    });
  }


  var getUserName = async function (userId) {
    let userid = mongoose.Types.ObjectId(userId);
    return userProfile.findById(userid, 'firstName lastName');
  }

  var validateprofilepic = function (profilePic) {
    let pic_parts = profilePic.split("base64");
    let result = true;
    let errors = [];

    if (pic_parts.length < 2) {
      return ({
        "result": false,
        "errors": "Invalid image"
      });
    }

    //validate size
    let imagesize = pic_parts[1].length;
    var sizeInBytes = 4 * Math.ceil(imagesize / 3) * 0.5624896334383812 / 1024;

    if (sizeInBytes > 50) {
      errors.push("Image size should not exceed 50KB");
      result = false;
      return;
    }

    let imagetype = pic_parts[0].split("/")[1];
    if (imagetype != "jpeg;" && imagetype != "png;") {
      errors.push("Image type shoud be either jpeg or png.");
      result = false;
      return;
    }

    return ({
      "result": result,
      "errors": errors
    });

  }

  var assignBlueBadgeforTimeNotMet = function () {
    logger.logInfo(`Job for assigning blue badge for commitment not met starting at ${moment().tz("America/Los_Angeles").format()}`)
    var pdtStartOfLastWeek = moment().tz("America/Los_Angeles").startOf("isoWeek").subtract(1, "week");
    var pdtEndOfLastWeek = moment().tz("America/Los_Angeles").endOf("isoWeek").subtract(1, "week");
    userProfile.find({
        isActive: true
      }, '_id')
      .then(users => {
        users.forEach(user => {
          const personId = mongoose.Types.ObjectId(user._id)
                  
          dashboardhelper.laborthisweek(personId, pdtStartOfLastWeek, pdtEndOfLastWeek)
            .then(results => {
              const weeklyComittedHours = results[0].weeklyComittedHours;
              const timeSpent = results[0].timeSpent_hrs;
              if (timeSpent < weeklyComittedHours) {
                const description = `System auto-assigned infringement for not meeting weekly volunteer time commitment. You logged ${timeSpent} hours against committed effort of ${weeklyComittedHours} hours in the week starting ${pdtStartOfLastWeek.format("dddd YYYY-MM-DD")} and ending ${pdtEndOfLastWeek.format("dddd YYYY-MM-DD")}`
                const infringment = {
                  date: moment().utc().format("YYYY-MM-DD"),
                  description: description
                }
                userProfile.findByIdAndUpdate(personId, {
                    $push: {
                      infringments: infringment
                    }
                  })
                  .then(status => emailSender(
                    recipient = status.email,
                    subject = "New Infringment Assigned",
                    message = getInfringmentEmailBody(status.firstName, status.lastName, infringment),
                    cc = null,
                    bcc = "onecommunityglobal@gmail.com"))
                  .catch(error => logger.logException(error))
              }
            })
            .catch(error => console.log(error))
        });

      })
      .catch(error => console.log(error))
  }

  var deleteBadgeAfterYear = function () {
    logger.logInfo(`Job for deleting badges older than 1 year starting at ${moment().tz("America/Los_Angeles").format()}`)
    let cutOffDate = moment().subtract(1, "year").format("YYYY-MM-DD")
    userProfile.updateMany({}, {
        $pull: {
          infringments: {
            date: {
              $lte: cutOffDate
            }
          }
        }
      })
      .then(results => logger.logInfo(results))
      .catch(error => logger.logException(error))


  }

  var notifyInfringments = function (original, current, firstName, lastName, emailAddress) {
    if (!current) return;
    original = original.toObject()
    current = current.toObject()
    let newInfringments = [];
    newInfringments = _.differenceWith(current, original, (arrVal, othVal) => arrVal._id.equals(othVal._id))
    newInfringments.forEach(element => {
      emailSender(
        recipient = emailAddress,
        subject = "New Infringment Assigned",
        message = getInfringmentEmailBody(firstName, lastName, element),
        cc = null,
        bcc = "onecommunityglobal@gmail.com")

    });


  }

  var getInfringmentEmailBody = function (firstName, lastName, infringment) {
    const text = `Dear <b>${firstName} ${lastName}</b>, 
        <p>
        Oops, it looks like something happened and you’ve managed to get a blue square.</p>
        <b>
        <div>Date Assigned: ${infringment.date}</div>
        <div>Description : ${infringment.description}</div>
        </b>
        <p>        
        No worries though, life happens and we understand that. That’s why we allow 5 of them before taking action. This action usually includes removal from our team, so please let your direct supervisor know what happened and do your best to avoid future blue squares if you are getting close to 5 and wish to avoid termination. Each blue square drops off after a year.
        </p>
        <p>Thank you,</p>
        <p><b> One Community </b></p>`

    return text;

  }

  return {

    getUserName: getUserName,
    getTeamMembers: getTeamMembers,
    validateprofilepic: validateprofilepic,
    assignBlueBadgeforTimeNotMet: assignBlueBadgeforTimeNotMet,
    deleteBadgeAfterYear: deleteBadgeAfterYear,
    notifyInfringments: notifyInfringments,
    getInfringmentEmailBody: getInfringmentEmailBody

  }

}

module.exports = userhelper;
