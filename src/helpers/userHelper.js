/* eslint-disable quotes */
/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const _ = require("lodash");
const userProfile = require("../models/userProfile");
const timeEntries = require("../models/timeentry");
const badge = require("../models/badge");
const myTeam = require("./helperModels/myTeam");
const dashboardHelper = require("./dashboardhelper")();
const reportHelper = require("./reporthelper")();
const emailSender = require("../utilities/emailSender");
const logger = require("../startup/logger");
const Reason = require("../models/reason");
const token = require("../models/profileInitialSetupToken");
const cache = require("../utilities/nodeCache")();
const timeOffRequest = require("../models/timeOffRequest");

const userHelper = function () {
  // Update format to "MMM-DD-YY" from "YYYY-MMM-DD" (Confirmed with Jae)
  const earnedDateBadge = () => {
    const currentDate = new Date(Date.now());
    return moment(currentDate).tz("America/Los_Angeles").format("MMM-DD-YY");
  };

  const getTeamMembers = function (user) {
    const userId = mongoose.Types.ObjectId(user._id);
    // var teamid = userdetails.teamId;
    return myTeam.findById(userId).select({
      "myTeam._id": 0,
      "myTeam.role": 0,
      "myTeam.fullName": 0,
      _id: 0,
    });
  };

  const getUserName = async function (userId) {
    const userid = mongoose.Types.ObjectId(userId);
    return userProfile.findById(userid, "firstName lastName");
  };

  const validateProfilePic = function (profilePic) {
    // if it is a url
    if (typeof profilePic !== "string") {
      return {
        result: false,
        errors: "Invalid image",
      };
    }
    if (profilePic.startsWith('http') || profilePic.startsWith('https')) {
      return {
        result: true,
        errors: "Valid image",
      };
    }

    const picParts = profilePic.split(",");
    let result = true;
    const errors = [];

    if (picParts.length < 2) {
      return {
        result: false,
        errors: "Invalid image",
      };
    }

    // validate size
    const imageSize = picParts[1].length;
    const sizeInBytes = (Math.ceil(imageSize / 4) * 3) / 1024;
    if (sizeInBytes > 50) {
      errors.push("Image size should not exceed 50KB");
      result = false;
    }

    const imageType = picParts[0].split("/")[1].split(";")[0];
    if (imageType !== "jpeg" && imageType !== "png") {
      errors.push("Image type shoud be either jpeg or png.");
      result = false;
    }

    return {
      result,
      errors,
    };
  };

  const getInfringementEmailBody = function (
    firstName,
    lastName,
    infringement,
    totalInfringements,
    timeRemaining,
    coreTeamExtraHour,
    requestForTimeOffEmailBody,
  ) {
    let finalParagraph = "";

    if (timeRemaining === undefined) {
      finalParagraph = "<p>Life happens and we understand that. That’s why we allow 5 of them before taking action. This action usually includes removal from our team though, so please let your direct supervisor know what happened and do your best to avoid future blue squares if you are getting close to 5 and wish to avoid termination. Each blue square drops off after a year.</p>";
    } else {
      finalParagraph = `Please complete ALL owed time this week (${
        timeRemaining + coreTeamExtraHour
      } hours) to avoid receiving another blue square. If you have any questions about any of this, please see the <a href="https://www.onecommunityglobal.org/policies-and-procedures/">"One Community Core Team Policies and Procedures"</a> page.`;
    }

    const text = `Dear <b>${firstName} ${lastName}</b>,
        <p>Oops, it looks like something happened and you’ve managed to get a blue square.</p>
        <p><b>Date Assigned:</b> ${infringement.date}</p>\
        <p><b>Description:</b> ${
          requestForTimeOffEmailBody || infringement.description }</p>
        <p><b>Total Infringements:</b> This is your <b>${moment
          .localeData()
          .ordinal(totalInfringements)}</b> blue square of 5.</p>
        ${finalParagraph}
        <p>Thank you, One Community</p>`;

    return text;
  };

  /**
   * This function will send out an email listing all users that have a summary provided for a specific week.
   * A week is represented by an weekIndex: 0, 1, 2 or 3, where 0 is the most recent and 3 the oldest.
   * It relies on the function weeklySummaries(startWeekIndex, endWeekIndex) to get the weekly summaries for the specific week.
   * In this case both the startWeekIndex and endWeekIndex are set to 1 to get the last weeks' summaries for all users.
   *
   * @param {int} [weekIndex=1] Numbered representation of a week where 0 is the most recent and 3 the oldest.
   *
   * @return {void}
   */
  const emailWeeklySummariesForAllUsers = async (weekIndex = 1) => {
    const currentFormattedDate = moment().tz("America/Los_Angeles").format();

    logger.logInfo(
      `Job for emailing all users' weekly summaries starting at ${currentFormattedDate}`,
    );

    const emails = [];
    let mappedResults; // this contains the emails

    try {
      const results = await reportHelper.weeklySummaries(weekIndex, weekIndex);
      // checks for userProfiles who are eligible to receive the weeklySummary Reports
      await userProfile
        .find({ getWeeklyReport: true }, { email: 1, _id: 0 })
        .then((results) => {
          mappedResults = results.map((ele) => ele.email);
          mappedResults.push(
            "onecommunityglobal@gmail.com",
            "onecommunityhospitality@gmail.com",
          );
          mappedResults = mappedResults.toString();
        });

      let emailBody = "<h2>Weekly Summaries for all active users:</h2>";

      const weeklySummaryNotProvidedMessage = '<div><b>Weekly Summary:</b> <span style="color: red;"> Not provided! </span> </div>';

      const weeklySummaryNotRequiredMessage = '<div><b>Weekly Summary:</b> <span style="color: green;"> Not required for this user </span></div>';

      results.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(
          `${b.firstName} ${b.lastname}`,
        ));

      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        const {
          firstName,
          lastName,
          email,
          weeklySummaries,
          mediaUrl,
          weeklySummariesCount,
          weeklycommittedHours,
          weeklySummaryOption,
        } = result;

        if (email !== undefined && email !== null) {
          emails.push(email);
        }

        // weeklySummaries array will have only one item fetched (if present),
        // consequently totalSeconds array will also have only one item in the array (if present)
        // hence totalSeconds[0] should be used
        const hoursLogged = result.totalSeconds[0] / 3600 || 0;

        const mediaUrlLink = mediaUrl
          ? `<a href="${mediaUrl}">${mediaUrl}</a>`
          : "Not provided!";

        let weeklySummaryMessage = weeklySummaryNotProvidedMessage;
        const colorStyle = (() => {
          switch (weeklySummaryOption) {
            case "Team":
              return 'style="color: magenta;"';
            case "Not Required":
              return 'style="color: green"';
            case "Required":
              return "";
            default:
              return result.weeklySummaryNotReq ? 'style="color: green"' : "";
          }
        })();
        // weeklySummaries array should only have one item if any, hence weeklySummaries[0] needs be used to access it.
        if (Array.isArray(weeklySummaries) && weeklySummaries[0]) {
          const { dueDate, summary } = weeklySummaries[0];
          if (summary) {
            weeklySummaryMessage = `
              <div>
                <b>Weekly Summary</b>
                (for the week ending on <b>${moment(dueDate)
                  .tz("America/Los_Angeles")
                  .format("YYYY-MMM-DD")}</b>):
              </div>
              <div data-pdfmake="{&quot;margin&quot;:[20,0,20,0]}" ${colorStyle}>
                ${summary}
              </div>
            `;
          } else if (
            weeklySummaryOption === "Not Required"
            || (!weeklySummaryOption && result.weeklySummaryNotReq)
          ) {
            weeklySummaryMessage = weeklySummaryNotRequiredMessage;
          }
        }

        emailBody += `
        \n
        <div style="padding: 20px 0; margin-top: 5px; border-bottom: 1px solid #828282;">
          <b>Name:</b> ${firstName} ${lastName}
          <p>

            <b>Media URL:</b> ${
              mediaUrlLink || '<span style="color: red;">Not provided!</span>'
            }

          </p>
          ${
            weeklySummariesCount === 8
              ? `<p style="color: blue;"><b>Total Valid Weekly Summaries: ${weeklySummariesCount}</b></p>`
              : `<p><b>Total Valid Weekly Summaries</b>: ${
                  weeklySummariesCount || "No valid submissions yet!"
                }</p>`
          }
          ${
            hoursLogged >= weeklycommittedHours
              ? `<p><b>Hours logged</b>: ${hoursLogged.toFixed(
                  2,
                )} / ${weeklycommittedHours}</p>`
              : `<p style="color: red;"><b>Hours logged</b>: ${hoursLogged.toFixed(
                  2,
                )} / ${weeklycommittedHours}</p>`
          }
          ${weeklySummaryMessage}
        </div>`;
      }

      // Necessary because our version of node is outdated
      // and doesn't have String.prototype.replaceAll
      let emailString = [...new Set(emails)].toString();
      while (emailString.includes(",")) {
        emailString = emailString.replace(",", "\n");
      }
      while (emailString.includes("\n")) {
        emailString = emailString.replace("\n", ", ");
      }

      emailBody += `\n
        <div>
          <h3>Emails</h3>
          <p>
            ${emailString}
          </p>
        </div>
      `;

      const mailList = mappedResults;

      emailSender(
        mailList,
        "Weekly Summaries for all active users...",
        emailBody,
        null,
        null,
        emailString,
      );
    } catch (err) {
      logger.logException(err);
    }
  };

  /**
   * This function will process the weeklySummaries array in the following way:
   *  1 ) Push a new (blank) summary at the beginning of the array.
   *  2 ) Always maintains 4 items in the array where each item represents a summary for a given week.
   *
   * @param {ObjectId} personId This is mongoose.Types.ObjectId object.
   */
  const processWeeklySummariesByUserId = function (personId) {
    userProfile
      .findByIdAndUpdate(personId, {
        $push: {
          weeklySummaries: {
            $each: [
              {
                dueDate: moment().tz("America/Los_Angeles").endOf("week"),
                summary: "",
              },
            ],
            $position: 0,
            $slice: 4,
          },
        },
      })
      .catch((error) => logger.logException(error));
  };

  /**
   * This function is called by a cron job to do 3 things to all active users:
   *  1 ) Determine whether there's been an infringement for the weekly summary for last week.
   *  2 ) Determine whether there's been an infringement for the time not met for last week.
   *  3 ) Call the processWeeklySummariesByUserId(personId) to process the weeklySummaries array.
   */
  const assignBlueSquareForTimeNotMet = async () => {
    try {
      const currentFormattedDate = moment().tz("America/Los_Angeles").format();
      const currentUTCDate = moment
        .tz("America/Los_Angeles")
        .startOf("day")
        .toISOString();

      logger.logInfo(
        `Job for assigning blue square for commitment not met starting at ${currentFormattedDate}`,
      );

      const pdtStartOfLastWeek = moment()
        .tz("America/Los_Angeles")
        .startOf("week")
        .subtract(1, "week");

      const pdtEndOfLastWeek = moment()
        .tz("America/Los_Angeles")
        .endOf("week")
        .subtract(1, "week");

      const users = await userProfile.find(
        { isActive: true },
        "_id weeklycommittedHours weeklySummaries missedHours",
      );

      // this part is supposed to be a for, so it'll be slower when sending emails, so the emails will not be
      // targeted as spam
      // There's no need to put Promise.all here
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];

        const person = await userProfile.findById(user._id);

        const personId = mongoose.Types.ObjectId(user._id);

        let hasWeeklySummary = false;

        if (
          Array.isArray(user.weeklySummaries)
          && user.weeklySummaries.length
        ) {
          const { summary } = user.weeklySummaries[0];
          if (summary) {
            hasWeeklySummary = true;
          }
        }

        //  This needs to run AFTER the check for weekly summary above because the summaries array will be updated/shifted after this function runs.
        await processWeeklySummariesByUserId(personId);

        const results = await dashboardHelper.laborthisweek(
          personId,
          pdtStartOfLastWeek,
          pdtEndOfLastWeek,
        );

        const { timeSpent_hrs: timeSpent } = results[0];

        const weeklycommittedHours = user.weeklycommittedHours + (user.missedHours ?? 0);

        const timeNotMet = timeSpent < weeklycommittedHours;

        let description;

        const timeRemaining = weeklycommittedHours - timeSpent;

        const updateResult = await userProfile.findByIdAndUpdate(
          personId,
          {
            $inc: {
              totalTangibleHrs: timeSpent || 0,
            },
            $max: {
              personalBestMaxHrs: timeSpent || 0,
            },
            $push: {
              savedTangibleHrs: { $each: [timeSpent || 0], $slice: -200 },
            },
            $set: {
              lastWeekTangibleHrs: timeSpent || 0,
            },
          },
          { new: true },
        );

        if (
          updateResult?.weeklySummaryOption === "Not Required"
          || updateResult?.weeklySummaryNotReq
        ) {
          hasWeeklySummary = true;
        }

        const cutOffDate = moment().subtract(1, "year");

        const oldInfringements = [];
        for (let k = 0; k < updateResult?.infringements.length; k += 1) {
          if (
            updateResult?.infringements
            && moment(updateResult?.infringements[k].date).diff(cutOffDate) >= 0
          ) {
            oldInfringements.push(updateResult.infringements[k]);
          } else {
            break;
          }
        }

        if (oldInfringements.length) {
          userProfile.findByIdAndUpdate(
            personId,
            {
              $push: {
                oldInfringements: { $each: oldInfringements, $slice: -10 },
              },
            },
            { new: true },
          );
        }
        // No extra hours is needed if blue squares isn't over 5.
        // length +1 is because new infringement hasn't been created at this stage.
        const coreTeamExtraHour = Math.max(0, oldInfringements.length + 1 - 5);

        const utcStartMoment = moment(pdtStartOfLastWeek).add(1, 'second');
        const utcEndMoment = moment(pdtEndOfLastWeek).subtract(1, 'day').subtract(1, 'second');

        const requestsForTimeOff = await timeOffRequest.find({
          requestFor: personId,
          startingDate: { $lte: utcStartMoment },
          endingDate: { $gte: utcEndMoment },
        });

        const hasTimeOffRequest = requestsForTimeOff.length > 0;
        let requestForTimeOff;
        let requestForTimeOffStartingDate;
        let requestForTimeOffEndingDate;
        let requestForTimeOffreason;
        let requestForTimeOffEmailBody;

        if (hasTimeOffRequest) {
          requestForTimeOff = requestsForTimeOff[0];
          requestForTimeOffStartingDate = moment(
            requestForTimeOff.startingDate,
          ).format("dddd YYYY-MM-DD");
          requestForTimeOffEndingDate = moment(
            requestForTimeOff.endingDate,
          ).format("dddd YYYY-MM-DD");
          requestForTimeOffreason = requestForTimeOff.reason;
          requestForTimeOffEmailBody = `<span style="color: blue;">You had scheduled time off From ${requestForTimeOffStartingDate}, To ${requestForTimeOffEndingDate}, due to:</span> ${requestForTimeOffreason}`;
        }

        if (timeNotMet || !hasWeeklySummary) {
          if (hasTimeOffRequest) {
            description = requestForTimeOffreason;
          } else if (timeNotMet && !hasWeeklySummary) {
            if (person.role === "Core Team") {
              description = `System auto-assigned infringement for two reasons: not meeting weekly volunteer time commitment as well as not submitting a weekly summary. In the week starting ${pdtStartOfLastWeek.format(
                "dddd YYYY-MM-DD",
              )} and ending ${pdtEndOfLastWeek.format(
                "dddd YYYY-MM-DD",
              )}, you logged ${timeSpent.toFixed(
                2,
              )} hours against a committed effort of ${
                person.weeklycommittedHours
              } hours + ${
                person.missedHours ?? 0
              } hours owed for last week + ${coreTeamExtraHour} hours owed for this being your ${moment
                .localeData()
                .ordinal(
                  oldInfringements.length + 1,
                )} blue square. So you should have completed ${weeklycommittedHours} hours and you completed ${timeSpent.toFixed(
                2,
              )} hours.`;
            } else {
              description = `System auto-assigned infringement for two reasons: not meeting weekly volunteer time commitment as well as not submitting a weekly summary. For the hours portion, you logged ${timeSpent.toFixed(
                2,
              )} hours against a committed effort of ${weeklycommittedHours} hours in the week starting ${pdtStartOfLastWeek.format(
                "dddd YYYY-MM-DD",
              )} and ending ${pdtEndOfLastWeek.format("dddd YYYY-MM-DD")}.`;
            }
          } else if (timeNotMet) {
            if (person.role === "Core Team") {
              description = `System auto-assigned infringement for not meeting weekly volunteer time commitment. In the week starting ${pdtStartOfLastWeek.format(
                "dddd YYYY-MM-DD",
              )} and ending ${pdtEndOfLastWeek.format(
                "dddd YYYY-MM-DD",
              )}, you logged ${timeSpent.toFixed(
                2,
              )} hours against a committed effort of ${
                user.weeklycommittedHours
              } hours + ${
                person.missedHours ?? 0
              } hours owed for last week + ${coreTeamExtraHour} hours owed for this being your ${moment
                .localeData()
                .ordinal(
                  oldInfringements.length + 1,
                )} blue square. So you should have completed ${weeklycommittedHours} hours and you completed ${timeSpent.toFixed(
                2,
              )} hours.`;
            } else {
              description = `System auto-assigned infringement for not meeting weekly volunteer time commitment. You logged ${timeSpent.toFixed(
                2,
              )} hours against a committed effort of ${weeklycommittedHours} hours in the week starting ${pdtStartOfLastWeek.format(
                "dddd YYYY-MM-DD",
              )} and ending ${pdtEndOfLastWeek.format("dddd YYYY-MM-DD")}.`;
            }
          } else {
            description = `System auto-assigned infringement for not submitting a weekly summary for the week starting ${pdtStartOfLastWeek.format(
              "dddd YYYY-MM-DD",
            )} and ending ${pdtEndOfLastWeek.format("dddd YYYY-MM-DD")}.`;
          }

          const infringement = {
            date: moment().utc().format("YYYY-MM-DD"),
            description,
            createdDate: hasTimeOffRequest ? moment(requestForTimeOff.createdAt).format('YYYY-MM-DD') : null,
          };

          const status = await userProfile.findByIdAndUpdate(
            personId,
            {
              $push: {
                infringements: infringement,
              },
            },
            { new: true },
          );

          let emailBody = "";
          if (person.role === "Core Team" && timeRemaining > 0) {
            emailBody = getInfringementEmailBody(
              status.firstName,
              status.lastName,
              infringement,
              status.infringements.length,
              timeRemaining,
              coreTeamExtraHour,
              requestForTimeOffEmailBody,
            );
          } else {
            emailBody = getInfringementEmailBody(
              status.firstName,
              status.lastName,
              infringement,
              status.infringements.length,
              undefined,
              null,
              requestForTimeOffEmailBody,
            );
          }

          emailSender(
            status.email,
            "New Infringement Assigned",
            emailBody,
            null,
            "onecommunityglobal@gmail.com",
            status.email,
            null,
          );

          const categories = await dashboardHelper.laborThisWeekByCategory(
            personId,
            pdtStartOfLastWeek,
            pdtEndOfLastWeek,
          );

          if (Array.isArray(categories) && categories.length > 0) {
            await userProfile.findOneAndUpdate(
              { _id: personId, categoryTangibleHrs: { $exists: false } },
              { $set: { categoryTangibleHrs: [] } },
            );
          } else {
            continue;
          }

          for (let j = 0; j < categories.length; j += 1) {
            const elem = categories[j];

            if (elem._id == null) {
              elem._id = "Other";
            }

            const updateResult2 = await userProfile.findOneAndUpdate(
              { _id: personId, "categoryTangibleHrs.category": elem._id },
              { $inc: { "categoryTangibleHrs.$.hrs": elem.timeSpent_hrs } },
              { new: true },
            );

            if (!updateResult2) {
              await userProfile.findOneAndUpdate(
                {
                  _id: personId,
                  "categoryTangibleHrs.category": { $ne: elem._id },
                },
                {
                  $addToSet: {
                    categoryTangibleHrs: {
                      category: elem._id,
                      hrs: elem.timeSpent_hrs,
                    },
                  },
                },
              );
            }
          }
        }
      }
      await deleteOldTimeOffRequests();
    } catch (err) {
      logger.logException(err);
    }

    // processWeeklySummaries for nonActive users
    try {
      const inactiveUsers = await userProfile.find({ isActive: false }, "_id");
      for (let i = 0; i < inactiveUsers.length; i += 1) {
        const user = inactiveUsers[i];

        await processWeeklySummariesByUserId(
          mongoose.Types.ObjectId(user._id),
          false,
        );
      }
    } catch (err) {
      logger.logException(err);
    }
  };

  const applyMissedHourForCoreTeam = async () => {
    try {
      const currentDate = moment().tz("America/Los_Angeles").format();

      logger.logInfo(
        `Job for applying missed hours for Core Team members starting at ${currentDate}`,
      );

      const startOfLastWeek = moment()
        .tz("America/Los_Angeles")
        .startOf("week")
        .subtract(1, "week")
        .format("YYYY-MM-DD");

      const endOfLastWeek = moment()
        .tz("America/Los_Angeles")
        .endOf("week")
        .subtract(1, "week")
        .format("YYYY-MM-DD");

      const missedHours = await userProfile.aggregate([
        {
          $match: {
            role: "Core Team",
            isActive: true,
          },
        },
        {
          $lookup: {
            from: "timeEntries",
            localField: "_id",
            foreignField: "personId",
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$isTangible", true] },
                      { $gte: ["$dateOfWork", startOfLastWeek] },
                      { $lte: ["$dateOfWork", endOfLastWeek] },
                    ],
                  },
                },
              },
            ],
            as: "timeEntries",
          },
        },
        {
          $project: {
            _id: 1,
            missedHours: {
              $max: [
                {
                  $subtract: [
                    {
                      $sum: [
                        { $ifNull: ["$missedHours", 0] },
                        "$weeklycommittedHours",
                      ],
                    },
                    {
                      $divide: [
                        {
                          $sum: {
                            $map: {
                              input: "$timeEntries",
                              in: "$$this.totalSeconds",
                            },
                          },
                        },
                        3600,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
        },
      ]);

      const bulkOps = [];

      missedHours.forEach((obj) => {
        bulkOps.push({
          updateOne: {
            filter: { _id: obj._id },
            update: { missedHours: obj.missedHours },
          },
        });
      });

      await userProfile.bulkWrite(bulkOps);
    } catch (err) {
      logger.logException(err);
    }
  };

  const deleteBlueSquareAfterYear = async () => {
    const currentFormattedDate = moment().tz("America/Los_Angeles").format();

    logger.logInfo(
      `Job for deleting blue squares older than 1 year starting at ${currentFormattedDate}`,
    );

    const cutOffDate = moment().subtract(1, "year").format("YYYY-MM-DD");

    try {
      const results = await userProfile.updateMany(
        {},
        {
          $pull: {
            infringements: {
              date: {
                $lte: cutOffDate,
              },
            },
          },
        },
      );

      logger.logInfo(results);
    } catch (err) {
      logger.logException(err);
    }
  };

  const reActivateUser = async () => {
    const currentFormattedDate = moment().tz("America/Los_Angeles").format();

    logger.logInfo(
      `Job for activating users based on scheduled re-activation date starting at ${currentFormattedDate}`,
    );

    try {
      const users = await userProfile.find(
        { isActive: false, reactivationDate: { $exists: true } },
        "_id isActive reactivationDate",
      );
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];
        if (moment().isSameOrAfter(moment(user.reactivationDate))) {
          await userProfile.findByIdAndUpdate(
            user._id,
            {
              $set: {
                isActive: true,
              },
              $unset: {
                endDate: user.endDate,
              },
            },
            { new: true },
          );
          logger.logInfo(
            `User with id: ${user._id} was re-acticated at ${moment()
              .tz("America/Los_Angeles")
              .format()}.`,
          );
          const id = user._id;
          const person = await userProfile.findById(id);

          const endDate = moment(person.endDate).format("YYYY-MM-DD");
          logger.logInfo(
            `User with id: ${
              user._id
            } was re-acticated at ${moment().format()}.`,
          );

          const subject = `IMPORTANT:${person.firstName} ${person.lastName} has been RE-activated in the Highest Good Network`;

          const emailBody = `<p> Hi Admin! </p>

          <p>This email is to let you know that ${person.firstName} ${person.lastName} has been made active again in the Highest Good Network application after being paused on ${endDate}.</p>
          
          <p>If you need to communicate anything with them, this is their email from the system: ${person.email}.</p>
          
          <p> Thanks! </p>
          
          <p>The HGN A.I. (and One Community)</p>`;

          emailSender(
            "onecommunityglobal@gmail.com",
            subject,
            emailBody,
            null,
            null,
            person.email,
          );
        }
      }
    } catch (err) {
      logger.logException(err);
    }
  };

  const notifyInfringements = function (
    original,
    current,
    firstName,
    lastName,
    emailAddress,
  ) {
    if (!current) return;
    const newOriginal = original.toObject();
    const newCurrent = current.toObject();
    const totalInfringements = newCurrent.length;
    let newInfringements = [];

    newInfringements = _.differenceWith(
      newCurrent,
      newOriginal,
      (arrVal, othVal) => arrVal._id.equals(othVal._id),
    );
    newInfringements.forEach((element) => {
      emailSender(
        emailAddress,
        "New Infringement Assigned",
        getInfringementEmailBody(
          firstName,
          lastName,
          element,
          totalInfringements,
        ),

        null,
        "onecommunityglobal@gmail.com",
        emailAddress,
      );
    });
  };

  const replaceBadge = async function (personId, oldBadgeId, newBadgeId) {
    userProfile.updateOne(
      { _id: personId, "badgeCollection.badge": oldBadgeId },
      {
        $set: {
          "badgeCollection.$.badge": newBadgeId,
          "badgeCollection.$.lastModified": Date.now().toString(),
          "badgeCollection.$.count": 1,
          "badgeCollection.$.earnedDate": [earnedDateBadge()],
        },
      },
      (err) => {
        if (err) {
          throw new Error(err);
        }
      },
    );
  };

  const increaseBadgeCount = async function (personId, badgeId) {
    userProfile.updateOne(
      { _id: personId, "badgeCollection.badge": badgeId },
      {
        $inc: { "badgeCollection.$.count": 1 },
        $set: { "badgeCollection.$.lastModified": Date.now().toString() },
        $push: { "badgeCollection.$.earnedDate": earnedDateBadge() },
      },
      (err) => {
        if (err) {
          console.log(err);
        }
      },
    );
  };

  const addBadge = async function (
    personId,
    badgeId,
    count = 1,
    featured = false,
  ) {
    userProfile.findByIdAndUpdate(
      personId,
      {
        $push: {
          badgeCollection: {
            badge: badgeId,
            count,
            earnedDate: [earnedDateBadge()],
            featured,
            lastModified: Date.now().toString(),
          },
        },
      },
      (err) => {
        if (err) {
          throw new Error(err);
        }
      },
    );
  };

  const removeDupBadge = async function (personId, badgeId) {
    userProfile.findByIdAndUpdate(
      personId,
      {
        $pull: {
          badgeCollection: { _id: mongoose.Types.ObjectId(badgeId) },
        },
      },
      { new: true },
      (err) => {
        if (err) {
          throw new Error(err);
        }
      },
    );
  };

  const changeBadgeCount = async function (personId, badgeId, count) {
    if (count === 0) {
      removeDupBadge(personId, badgeId);
    } else if (count) {
      // Process exisiting earned date to match the new count
      try {
        const userInfo = await userProfile.findById(personId);
        let newEarnedDate = [];
        const recordToUpdate = userInfo.badgeCollection.find(
          (item) => item.badge._id.toString() === badgeId.toString(),
        );
        if (!recordToUpdate) {
          throw new Error("Badge not found");
        }
        // If the count is the same, do nothing
        if (recordToUpdate.count === count) {
          return;
        }
        const copyOfEarnedDate = recordToUpdate.earnedDate;
        // Update: We refrain from automatically correcting the mismatch problem as we intend to preserve the original
        // earned date even when a badge is deleted. This approach ensures that a record of badges earned is maintained,
        // preventing oversight of any mismatches caused by bugs.
        if (recordToUpdate.count < count) {
          let dateToAdd = count - recordToUpdate.count;
          // if the EarnedDate count is less than the new count, add a earned date to the end of the collection
          while (dateToAdd > 0) {
            copyOfEarnedDate.push(earnedDateBadge());
            dateToAdd -= 1;
          }
        }
        newEarnedDate = [...copyOfEarnedDate];
        userProfile.updateOne(
          { _id: personId, "badgeCollection.badge": badgeId },
          {
            $set: {
              "badgeCollection.$.count": count,
              "badgeCollection.$.lastModified": Date.now().toString(),
              "badgeCollection.$.earnedDate": newEarnedDate,
              "badgeCollection.$.hasBadgeDeletionImpact":
                recordToUpdate.count > count, // badge deletion impact set to true if the new count is less than the old count
            },
          },
          (err) => {
            if (err) {
              throw new Error(err);
            }
          },
        );
      } catch (err) {
        logger.logException(err);
      }
    }
  };

  // remove the last badge you earned on this streak(not including 1)

  const removePrevHrBadge = async function (
    personId,
    user,
    badgeCollection,
    hrs,
    weeks,
  ) {
    // Check each Streak Greater than One to check if it works
    if (weeks < 3) {
      return;
    }
    let removed = false;
    await badge
      .aggregate([
        {
          $match: {
            type: "X Hours for X Week Streak",
            weeks: { $gt: 1, $lt: weeks },
            totalHrs: hrs,
          },
        },
        { $sort: { weeks: -1, totalHrs: -1 } },
        {
          $group: {
            _id: "$weeks",
            badges: {
              $push: { _id: "$_id", hrs: "$totalHrs", weeks: "$weeks" },
            },
          },
        },
      ])
      .then((results) => {
        results.forEach((streak) => {
          streak.badges.every((bdge) => {
            for (let i = 0; i < badgeCollection.length; i += 1) {
              if (
                badgeCollection[i].badge?.type
                  === "X Hours for X Week Streak"
                && badgeCollection[i].badge?.weeks === bdge.weeks
                && bdge.hrs === hrs
                && !removed
              ) {
                changeBadgeCount(
                  personId,
                  badgeCollection[i].badge._id,
                  badgeCollection[i].badge.count - 1,
                );
                removed = true;
                return false;
              }
            }
            return true;
          });
        });
      });
  };

  //   'No Infringement Streak',
  const checkNoInfringementStreak = async function (
    personId,
    user,
    badgeCollection,
  ) {
    let badgeOfType;
    for (let i = 0; i < badgeCollection.length; i += 1) {
      if (badgeCollection[i].badge?.type === "No Infringement Streak") {
        if (
          badgeOfType
          && badgeOfType.months <= badgeCollection[i].badge.months
        ) {
          removeDupBadge(personId, badgeOfType._id);
          badgeOfType = badgeCollection[i].badge;
        } else if (
          badgeOfType
          && badgeOfType.months > badgeCollection[i].badge.months
        ) {
          removeDupBadge(personId, badgeCollection[i].badge._id);
        } else if (!badgeOfType) {
          badgeOfType = badgeCollection[i].badge;
        }
      }
    }
    await badge
      .find({ type: "No Infringement Streak" })
      .sort({ months: -1 })
      .then((results) => {
        if (!Array.isArray(results) || !results.length) {
          return;
        }

        results.every((elem) => {
          // Cannot account for time paused yet

          if (elem.months <= 12) {
            if (
              moment().diff(moment(user.createdDate), "months", true)
              >= elem.months
            ) {
              if (
                user.infringements.length === 0
                || Math.abs(
                  moment().diff(
                    moment(
                      user.infringements[user.infringements?.length - 1].date,
                    ),
                    "months",
                    true,
                  ),
                ) >= elem.months
              ) {
                if (badgeOfType) {
                  if (badgeOfType._id.toString() !== elem._id.toString()) {
                    replaceBadge(
                      personId,
                      mongoose.Types.ObjectId(badgeOfType._id),
                      mongoose.Types.ObjectId(elem._id),
                    );
                  }
                  return false;
                }
                addBadge(personId, mongoose.Types.ObjectId(elem._id));
                return false;
              }
            }
          } else if (user?.infringements?.length === 0) {
            if (
              moment().diff(moment(user.createdDate), "months", true)
              >= elem.months
            ) {
              if (
                user.oldInfringements.length === 0
                || Math.abs(
                  moment().diff(
                    moment(
                      user.oldInfringements[user.oldInfringements?.length - 1]
                        .date,
                    ),
                    "months",
                    true,
                  ),
                )
                  >= elem.months - 12
              ) {
                if (badgeOfType) {
                  if (badgeOfType._id.toString() !== elem._id.toString()) {
                    replaceBadge(
                      personId,
                      mongoose.Types.ObjectId(badgeOfType._id),
                      mongoose.Types.ObjectId(elem._id),
                    );
                  }
                  return false;
                }
                addBadge(personId, mongoose.Types.ObjectId(elem._id));
                return false;
              }
            }
          }
          return true;
        });
      });
  };

  // 'Minimum Hours Multiple',
  const checkMinHoursMultiple = async function (
    personId,
    user,
    badgeCollection,
  ) {
    const badgesOfType = badgeCollection
      .map((obj) => obj.badge)
      .filter((badgeItem) => badgeItem.type === "Minimum Hours Multiple");
    await badge
      .find({ type: "Minimum Hours Multiple" })
      .sort({ multiple: -1 })
      .then((results) => {
        if (!Array.isArray(results) || !results.length) {
          return;
        }
        for (let i = 0; i < results.length; i += 1) {
          // this needs to be a for loop so that the returns break before assigning badges for lower multiples
          const elem = results[i]; // making variable elem accessible for below code

          if (
            user.lastWeekTangibleHrs / user.weeklycommittedHours
            >= elem.multiple
          ) {
            const theBadge = badgesOfType.find(
              (badgeItem) => badgeItem._id.toString() === elem._id.toString(),
            );
            return theBadge
              ? increaseBadgeCount(
                  personId,
                  mongoose.Types.ObjectId(theBadge._id),
                )
              : addBadge(personId, mongoose.Types.ObjectId(elem._id));
          }
        }
      });
  };

  // 'Personal Max',
  const checkPersonalMax = async function (personId, user, badgeCollection) {
    let badgeOfType;
    const duplicateBadges = [];

    for (let i = 0; i < badgeCollection.length; i += 1) {
      if (badgeCollection[i].badge?.type === "Personal Max") {
        if (!badgeOfType) {
          badgeOfType = badgeCollection[i];
        } else {
          duplicateBadges.push(badgeCollection[i]);
        }
      }
      for (const b of duplicateBadges) {
        await removeDupBadge(personId, b._id);
      }
    }
    await badge.findOne({ type: "Personal Max" }).then((results) => {
      if (
        user.lastWeekTangibleHrs
        && user.lastWeekTangibleHrs >= 1
        && user.lastWeekTangibleHrs === user.personalBestMaxHrs
      ) {
        if (badgeOfType) {
          changeBadgeCount(
            personId,
            mongoose.Types.ObjectId(badgeOfType._id),
            user.personalBestMaxHrs,
          );
        } else {
          addBadge(
            personId,
            mongoose.Types.ObjectId(results._id),
            user.personalBestMaxHrs,
          );
        }
      }
    });
  };

  // 'Most Hrs in Week'

  const checkMostHrsWeek = async function (personId, user, badgeCollection) {
    if (
      user.weeklycommittedHours > 0
      && user.lastWeekTangibleHrs > user.weeklycommittedHours
    ) {
      const badgeOfType = badgeCollection
        .filter((object) => object.badge.type === "Most Hrs in Week")
        .map((object) => object.badge);
      await badge.findOne({ type: "Most Hrs in Week" }).then((results) => {
        userProfile
          .aggregate([
            { $match: { isActive: true } },
            { $group: { _id: 1, maxHours: { $max: "$lastWeekTangibleHrs" } } },
          ])
          .then((userResults) => {
            if (badgeOfType.length > 1) {
              removeDupBadge(user._id, badgeOfType[0]._id);
            }

            if (
              user.lastWeekTangibleHrs
              && user.lastWeekTangibleHrs >= userResults[0].maxHours
            ) {
              if (badgeOfType.length) {
                increaseBadgeCount(
                  personId,
                  mongoose.Types.ObjectId(badgeOfType[0]._id),
                );
              } else {
                addBadge(personId, mongoose.Types.ObjectId(results._id));
              }
            }
          });
      });
    }
  };

  // 'X Hours for X Week Streak',
  const checkXHrsForXWeeks = async function (personId, user, badgeCollection) {
    // Handle Increasing the 1 week streak badges
    const badgesOfType = [];
    for (let i = 0; i < badgeCollection.length; i += 1) {
      if (badgeCollection[i].badge?.type === "X Hours for X Week Streak") {
        badgesOfType.push(badgeCollection[i].badge);
      }
    }
    await badge
      .find({ type: "X Hours for X Week Streak", weeks: 1 })
      .sort({ totalHrs: -1 })
      .then((results) => {
        results.every((elem) => {
          if (elem.totalHrs <= user.lastWeekTangibleHrs) {
            let theBadge;
            for (let i = 0; i < badgesOfType.length; i += 1) {
              if (badgesOfType[i]._id.toString() === elem._id.toString()) {
                theBadge = badgesOfType[i]._id;
                break;
              }
            }
            if (theBadge) {
              increaseBadgeCount(personId, mongoose.Types.ObjectId(theBadge));
              return false;
            }
            addBadge(personId, mongoose.Types.ObjectId(elem._id));
            return false;
          }
          return true;
        });
      });
    // Check each Streak Greater than One to check if it works
    await badge
      .aggregate([
        { $match: { type: "X Hours for X Week Streak", weeks: { $gt: 1 } } },
        { $sort: { weeks: -1, totalHrs: -1 } },
        {
          $group: {
            _id: "$weeks",
            badges: {
              $push: { _id: "$_id", hrs: "$totalHrs", weeks: "$weeks" },
            },
          },
        },
      ])
      .then((results) => {
        let lastHr = -1;
        results.forEach((streak) => {
          streak.badges.every((bdge) => {
            let badgeOfType;
            for (let i = 0; i < badgeCollection.length; i += 1) {
              if (
                badgeCollection[i].badge?.type
                  === "X Hours for X Week Streak"
                && badgeCollection[i].badge?.weeks === bdge.weeks
              ) {
                if (
                  badgeOfType
                  && badgeOfType.totalHrs <= badgeCollection[i].badge.totalHrs
                ) {
                  removeDupBadge(personId, badgeOfType._id);
                  badgeOfType = badgeCollection[i].badge;
                } else if (
                  badgeOfType
                  && badgeOfType.totalHrs > badgeCollection[i].badge.totalHrs
                ) {
                  removeDupBadge(personId, badgeCollection[i].badge._id);
                } else if (!badgeOfType) {
                  badgeOfType = badgeCollection[i].badge;
                }
              }
            }
            // check if it is possible to earn this streak
            if (user.savedTangibleHrs.length >= bdge.weeks) {
              let awardBadge = true;
              const endOfArr = user.savedTangibleHrs.length - 1;
              for (let i = endOfArr; i >= endOfArr - bdge.weeks + 1; i -= 1) {
                if (user.savedTangibleHrs[i] < bdge.hrs) {
                  awardBadge = false;
                  return true;
                }
              }
              // if all checks for award badge are green double check that we havent already awarded a higher streak for the same number of hours
              if (awardBadge && bdge.hrs > lastHr) {
                lastHr = bdge.hrs;
                if (badgeOfType && badgeOfType.totalHrs < bdge.hrs) {
                  replaceBadge(
                    personId,
                    mongoose.Types.ObjectId(badgeOfType._id),
                    mongoose.Types.ObjectId(bdge._id),
                  );

                  removePrevHrBadge(
                    personId,
                    user,
                    badgeCollection,
                    bdge.hrs,
                    bdge.weeks,
                  );
                } else if (!badgeOfType) {
                  addBadge(personId, mongoose.Types.ObjectId(bdge._id));
                  removePrevHrBadge(
                    personId,
                    user,
                    badgeCollection,
                    bdge.hrs,
                    bdge.weeks,
                  );
                } else if (badgeOfType && badgeOfType.totalHrs === bdge.hrs) {
                  increaseBadgeCount(
                    personId,
                    mongoose.Types.ObjectId(badgeOfType._id),
                  );
                  removePrevHrBadge(
                    personId,
                    user,
                    badgeCollection,
                    bdge.hrs,
                    bdge.weeks,
                  );
                }
                return false;
              }
            }
            return true;
          });
        });
      });
  };

  // 'Lead a team of X+'

  const checkLeadTeamOfXplus = async function (
    personId,
    user,
    badgeCollection,
  ) {
    const leaderRoles = [
      "Mentor",
      "Manager",
      "Administrator",
      "Owner",
      "Core Team",
    ];
    const approvedRoles = ["Mentor", "Manager"];
    if (!approvedRoles.includes(user.role)) return;

    let teamMembers;
    await getTeamMembers({
      _id: personId,
    }).then((results) => {
      if (results) {
        teamMembers = results.myteam;
      } else {
        teamMembers = [];
      }
    });

    const objIds = {};

    teamMembers = teamMembers.filter((member) => {
      if (leaderRoles.includes(member.role)) return false;
      if (objIds[member._id]) return false;
      objIds[member._id] = true;

      return true;
    });
    let badgeOfType;
    for (let i = 0; i < badgeCollection.length; i += 1) {
      if (badgeCollection[i].badge?.type === "Lead a team of X+") {
        if (
          badgeOfType
          && badgeOfType.people <= badgeCollection[i].badge.people
        ) {
          removeDupBadge(personId, badgeOfType._id);
          badgeOfType = badgeCollection[i].badge;
        } else if (
          badgeOfType
          && badgeOfType.people > badgeCollection[i].badge.people
        ) {
          removeDupBadge(personId, badgeCollection[i].badge._id);
        } else if (!badgeOfType) {
          badgeOfType = badgeCollection[i].badge;
        }
      }
    }
    await badge
      .find({ type: "Lead a team of X+" })
      .sort({ people: -1 })
      .then((results) => {
        if (!Array.isArray(results) || !results.length) {
          return;
        }
        results.every((bg) => {
          if (teamMembers && teamMembers.length >= bg.people) {
            if (badgeOfType) {
              if (
                badgeOfType._id.toString() !== bg._id.toString()
                && badgeOfType.people < bg.people
              ) {
                replaceBadge(
                  personId,
                  mongoose.Types.ObjectId(badgeOfType._id),

                  mongoose.Types.ObjectId(bg._id),
                );
              }
              return false;
            }
            addBadge(personId, mongoose.Types.ObjectId(bg._id));
            return false;
          }
          return true;
        });
      });
  };

  // 'Total Hrs in Category'
  const checkTotalHrsInCat = async function (personId, user, badgeCollection) {
    const hoursByCategory = user.hoursByCategory || {};
    const categories = [
      "food",
      "energy",
      "housing",
      "education",
      "society",
      "economics",
      "stewardship",
    ];

    const badgesOfType = badgeCollection
      .filter((object) => object.badge.type === "Total Hrs in Category")
      .map((object) => object.badge);

    categories.forEach(async (category) => {
      const categoryHrs = Object.keys(hoursByCategory).find(
        (elem) => elem === category,
      );

      let badgeOfType;
      for (let i = 0; i < badgeCollection.length; i += 1) {
        if (
          badgeCollection[i].badge?.type === "Total Hrs in Category"
          && badgeCollection[i].badge?.category === category
        ) {
          if (
            badgeOfType
            && badgeOfType.totalHrs <= badgeCollection[i].badge.totalHrs
          ) {
            removeDupBadge(personId, badgeOfType._id);
            badgeOfType = badgeCollection[i].badge;
          } else if (
            badgeOfType
            && badgeOfType.totalHrs > badgeCollection[i].badge.totalHrs
          ) {
            removeDupBadge(personId, badgeCollection[i].badge._id);
          } else if (!badgeOfType) {
            badgeOfType = badgeCollection[i].badge;
          }
        }
      }

      const newCatg = category.charAt(0).toUpperCase() + category.slice(1);

      await badge
        .find({ type: "Total Hrs in Category", category: newCatg })

        .sort({ totalHrs: -1 })
        .then((results) => {
          if (!Array.isArray(results) || !results.length || !categoryHrs) {
            return;
          }

          results.every((elem) => {
            if (
              hoursByCategory[categoryHrs] >= 100
              && hoursByCategory[categoryHrs] >= elem.totalHrs
            ) {
              let theBadge;
              for (let i = 0; i < badgesOfType.length; i += 1) {
                if (badgesOfType[i]._id.toString() === elem._id.toString()) {
                  theBadge = badgesOfType[i]._id;
                  break;
                }
              }
              if (theBadge) {
                increaseBadgeCount(personId, mongoose.Types.ObjectId(theBadge));
                return false;
              }
              if (badgeOfType) {
                if (
                  badgeOfType._id.toString() !== elem._id.toString()
                  && badgeOfType.totalHrs < elem.totalHrs
                ) {
                  replaceBadge(
                    personId,
                    mongoose.Types.ObjectId(badgeOfType._id),
                    mongoose.Types.ObjectId(elem._id),
                  );
                }
                return false;
              }
              addBadge(personId, mongoose.Types.ObjectId(elem._id));
              return false;
            }
            return true;
          });
        });
    });
  };

  const awardNewBadges = async () => {
    try {
      const users = await userProfile
        .find({ isActive: true })
        .populate("badgeCollection.badge");
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];
        const { _id, badgeCollection } = user;
        const personId = mongoose.Types.ObjectId(_id);

        await checkPersonalMax(personId, user, badgeCollection);
        await checkMostHrsWeek(personId, user, badgeCollection);
        await checkMinHoursMultiple(personId, user, badgeCollection);
        await checkTotalHrsInCat(personId, user, badgeCollection);
        await checkLeadTeamOfXplus(personId, user, badgeCollection);
        await checkXHrsForXWeeks(personId, user, badgeCollection);
        await checkNoInfringementStreak(personId, user, badgeCollection);
        // remove cache after badge asssignment.
        if (cache.hasCache(`user-${_id}`)) {
          cache.removeCache(`user-${_id}`);
        }
      }
    } catch (err) {
      logger.logException(err);
    }
  };

  const getTangibleHoursReportedThisWeekByUserId = function (personId) {
    const userId = mongoose.Types.ObjectId(personId);

    const pdtstart = moment()
      .tz("America/Los_Angeles")
      .startOf("week")
      .format("YYYY-MM-DD");
    const pdtend = moment()
      .tz("America/Los_Angeles")
      .endOf("week")
      .format("YYYY-MM-DD");

    return timeEntries
      .find(
        {
          personId: userId,
          dateOfWork: { $gte: pdtstart, $lte: pdtend },
          isTangible: true,
        },
        "totalSeconds",
      )
      .then((results) => {
        const totalTangibleWeeklySeconds = results.reduce(
          (acc, { totalSeconds }) => acc + totalSeconds,
          0,
        );
        return (totalTangibleWeeklySeconds / 3600).toFixed(2);
      });
  };

  const deActivateUser = async () => {
    try {
      const users = await userProfile.find(
        { isActive: true, endDate: { $exists: true } },
        "_id isActive endDate",
      );
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];
        const { endDate } = user;
        endDate.setHours(endDate.getHours() + 7);
        if (moment().isAfter(moment(endDate).add(1, "days"))) {
          await userProfile.findByIdAndUpdate(
            user._id,
            user.set({
              isActive: false,
            }),
            { new: true },
          );
          const id = user._id;
          const person = await userProfile.findById(id);

          const lastDay = moment(person.endDate).format("YYYY-MM-DD");
          logger.logInfo(
            `User with id: ${
              user._id
            } was de-acticated at ${moment().format()}.`,
          );

          const subject = `IMPORTANT:${person.firstName} ${person.lastName} has been deactivated in the Highest Good Network`;

          const emailBody = `<p> Hi Admin! </p>

          <p>This email is to let you know that ${person.firstName} ${person.lastName} has completed their scheduled last day (${lastDay}) and been deactivated in the Highest Good Network application. </p>
          
          <p>This is their email from the system: ${person.email}. Please email them to let them know their work is complete and thank them for their volunteer time with One Community. </p>
          
          <p> Thanks! </p>
          
          <p>The HGN A.I. (and One Community)</p>`;

          emailSender(
            "onecommunityglobal@gmail.com",
            subject,
            emailBody,
            null,
            null,
            person.email,
          );
        }
      }
    } catch (err) {
      logger.logException(err);
    }
  };

  /* Function for deleting expired tokens used in new user setup from database  */
  const deleteExpiredTokens = async () => {
    const currentDate = new Date();
    try {
      await token.deleteMany({ expiration: { $lt: currentDate } });
    } catch (error) {
      logger.logException(error);
    }
  };

  const deleteOldTimeOffRequests = async () => {
    const endOfLastWeek = moment()
      .tz("America/Los_Angeles")
      .endOf("week")
      .subtract(1, "week");

    const utcEndMoment = moment(endOfLastWeek).subtract(1, 'day').add(1, 'second');
    try {
      await timeOffRequest.deleteMany({ endingDate: { $lte: utcEndMoment } });
    } catch (error) {
      console.error("Error deleting expired time off requests:", error);
    }
  };

  return {
    changeBadgeCount,
    getUserName,
    getTeamMembers,
    validateProfilePic,
    assignBlueSquareForTimeNotMet,
    applyMissedHourForCoreTeam,
    deleteBlueSquareAfterYear,
    reActivateUser,
    deActivateUser,
    notifyInfringements,
    getInfringementEmailBody,
    emailWeeklySummariesForAllUsers,
    awardNewBadges,
    getTangibleHoursReportedThisWeekByUserId,
    deleteExpiredTokens,
    deleteOldTimeOffRequests,
  };
};

module.exports = userHelper;
