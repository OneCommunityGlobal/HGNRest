/* eslint-disable quotes */
/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/* eslint-disable consistent-return  */
/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-use-before-define */
/* eslint-disable no-unsafe-optional-chaining */
/* eslint-disable no-restricted-syntax */

const fs = require('fs');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const _ = require('lodash');
const cheerio = require('cheerio');
const axios = require('axios');
const sharp = require('sharp');
const userProfile = require('../models/userProfile');
const timeEntries = require('../models/timeentry');
const badge = require('../models/badge');
const myTeam = require('./helperModels/myTeam');
const dashboardHelper = require('./dashboardhelper')();
const reportHelper = require('./reporthelper')();
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');
const token = require('../models/profileInitialSetupToken');
const BlueSquareEmailAssignment = require('../models/BlueSquareEmailAssignment');
const cache = require('../utilities/nodeCache')();
const timeOffRequest = require('../models/timeOffRequest');
const notificationService = require('../services/notificationService');
const { NEW_USER_BLUE_SQUARE_NOTIFICATION_MESSAGE } = require('../constants/message');
const timeUtils = require('../utilities/timeUtils');
const Team = require('../models/team');
const BlueSquareEmailAssignmentModel = require('../models/BlueSquareEmailAssignment');

// eslint-disable-next-line no-promise-executor-return
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const userHelper = function () {
  // Update format to "MMM-DD-YY" from "YYYY-MMM-DD" (Confirmed with Jae)
  const earnedDateBadge = () => {
    const currentDate = new Date(Date.now());
    return moment(currentDate).tz('America/Los_Angeles').format('MMM-DD-YY');
  };

  const getTeamMembers = function (user) {
    const userId = mongoose.Types.ObjectId(user._id);
    // var teamid = userdetails.teamId;
    return myTeam.findById(userId).select({
      'myTeam._id': 0,
      'myTeam.role': 0,
      'myTeam.fullName': 0,
      _id: 0,
    });
  };

  const getTeamMembersForBadge = async function (user) {
    try {
      const results = await Team.aggregate([
        {
          $match: {
            'members.userId': mongoose.Types.ObjectId(user._id),
          },
        },
        { $unwind: '$members' }, // Deconstructs the 'members' array to get each member as a separate document
        {
          $lookup: {
            from: 'userProfiles', // Joining with 'userProfiles' collection
            localField: 'members.userId',
            foreignField: '_id',
            as: 'userProfile',
          },
        },
        { $unwind: { path: '$userProfile', preserveNullAndEmptyArrays: true } }, // Preserves members even if they have no profile
        {
          $project: {
            team_id: '$_id', // Keeping team ID
            _id: '$members.userId', // Member ID
            role: '$userProfile.role', // Role from user profile
            firstName: '$userProfile.firstName', // First name from user profile
            lastName: '$userProfile.lastName', // Last name from user profile
            fullName: '$userProfile.fullName',
            addDateTime: '$members.addDateTime', // Date they joined the team
            teamName: '$teamName', // Team name
          },
        },
      ]);
      return results;
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  const getTeamManagementEmail = function (teamId) {
    const parsedTeamId = mongoose.Types.ObjectId(teamId);
    return userProfile
      .find(
        {
          isActive: true,
          teams: {
            $in: [parsedTeamId],
          },
          role: {
            $in: ['Manager', 'Administrator'],
          },
        },
        'email role',
      )
      .exec();
  };

  const getUserName = async function (userId) {
    const userid = mongoose.Types.ObjectId(userId);
    return userProfile.findById(userid, 'firstName lastName');
  };

  const validateProfilePic = function (profilePic) {
    // if it is a url
    if (typeof profilePic !== 'string') {
      return {
        result: false,
        errors: 'Invalid image',
      };
    }
    if (profilePic.startsWith('http') || profilePic.startsWith('https')) {
      return {
        result: true,
        errors: 'Valid image',
      };
    }

    const picParts = profilePic.split(',');
    let result = true;
    const errors = [];

    if (picParts.length < 2) {
      return {
        result: false,
        errors: 'Invalid image',
      };
    }

    // validate size
    const imageSize = picParts[1].length;
    const sizeInBytes = (Math.ceil(imageSize / 4) * 3) / 1024;
    if (sizeInBytes > 50) {
      errors.push('Image size should not exceed 50KB');
      result = false;
    }

    const imageType = picParts[0].split('/')[1].split(';')[0];
    if (imageType !== 'jpeg' && imageType !== 'png' && imageType !== 'svg+xml') {
      errors.push('Image type shoud be either jpeg or png.');
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
    administrativeContent,
    weeklycommittedHours,
  ) {
    let finalParagraph = '';
    let descrInfringement = '';
    if (timeRemaining === undefined) {
      finalParagraph =
        '<p>Life happens and we understand that. That’s why we allow 5 of them before taking action. This action usually includes removal from our team though, so please let your direct supervisor know what happened and do your best to avoid future blue squares if you are getting close to 5 and wish to avoid termination. Each blue square drops off after a year.</p>';
      descrInfringement = `<p><b>Total Infringements:</b> This is your <b>${moment
        .localeData()
        .ordinal(totalInfringements)}</b> blue square of 5.</p>`;
    } else {
      let hrThisweek = weeklycommittedHours || 0 + coreTeamExtraHour;
      const remainHr = timeRemaining || 0;
      hrThisweek += remainHr;
      finalParagraph = `Please complete ALL owed time this week (${
        hrThisweek + totalInfringements - 5
      } hours) to avoid receiving another blue square. If you have any questions about any of this, please see the <a href="https://www.onecommunityglobal.org/policies-and-procedures/">"One Community Core Team Policies and Procedures"</a> page.`;
      descrInfringement = `<p><b>Total Infringements:</b> This is your <b>${moment
        .localeData()
        .ordinal(
          totalInfringements,
        )}</b> blue square of 5 and that means you have ${totalInfringements - 5} hour(s) added to your
          requirement this week. This is in addition to any hours missed for last week:
          ${weeklycommittedHours} hours commitment + ${remainHr} hours owed for last week + ${totalInfringements - 5} hours
          owed for this being your <b>${moment
            .localeData()
            .ordinal(
              totalInfringements,
            )} blue square = ${hrThisweek + totalInfringements - 5} hours required for this week.
          .</p>`;
    }
    // bold description for 'System auto-assigned infringement for two reasons ....' and 'not submitting a weekly summary' and logged hrs
    let emailDescription = requestForTimeOffEmailBody;
    if (!requestForTimeOffEmailBody && infringement.description) {
      const sentences = infringement.description.split('.');
      if (sentences[0].includes('System auto-assigned infringement for two reasons')) {
        sentences[0] = sentences[0].replace(
          /(not meeting weekly volunteer time commitment as well as not submitting a weekly summary)/gi,
          '<b>$1</b>',
        );
        emailDescription = sentences.join('.');
        emailDescription = emailDescription.replace(
          /logged (\d+(\.\d+)?\s*hours)/i,
          'logged <b>$1</b>',
        );
      } else if (
        sentences[0].includes('System auto-assigned infringement for editing your time entries')
      ) {
        sentences[0] = sentences[0].replace(
          /time entries <(\d+)>\s*times/i,
          'time entries <b>$1 times</b>',
        );
        emailDescription = sentences.join('.');
      } else if (sentences[0].includes('System auto-assigned infringement')) {
        sentences[0] = sentences[0].replace(/(not submitting a weekly summary)/gi, '<b>$1</b>');
        sentences[0] = sentences[0].replace(
          /(not meeting weekly volunteer time commitment)/gi,
          '<b>$1</b>',
        );
        emailDescription = sentences.join('.');
        emailDescription = emailDescription.replace(
          /logged (\d+(\.\d+)?\s*hours)/i,
          'logged <b>$1</b>',
        );
      } else {
        emailDescription = `<b>${infringement.description}<b>`;
      }
    }
    // add administrative content
    const text = `Dear <b>${firstName} ${lastName}</b>,
        <p>Oops, it looks like something happened and you’ve managed to get a blue square.</p>
        <p><b>Date Assigned:</b> ${moment(infringement.date).format('M-D-YYYY')}</p>\
        <p><b>Description:</b> ${emailDescription}</p>
        ${descrInfringement}
        ${finalParagraph}
        <p>Thank you,<p>
        <p>One Community</p>
        <!-- Adding multiple non-breaking spaces -->
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <hr style="border-top: 1px dashed #000;"/>
        <p><b>ADMINISTRATIVE DETAILS:</b></p>
        <p><b>Start Date:</b> ${administrativeContent.startDate}</p>
        <p><b>Role:</b> ${administrativeContent.role}</p>
        <p><b>Title:</b> ${administrativeContent.userTitle || 'Volunteer'} </p>
        <p><b>Previous Blue Square Reasons: </b></p>
        ${administrativeContent.historyInfringements}`;

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
    const currentFormattedDate = moment().tz('America/Los_Angeles').format();
    /* eslint-disable no-undef */
    logger.logInfo(
      `Job for emailing all users' weekly summaries starting at ${currentFormattedDate}`,
    );

    const emails = [];
    let mappedResults; // this contains the emails

    try {
      const results = await reportHelper.weeklySummaries(weekIndex, weekIndex);
      // checks for userProfiles who are eligible to receive the weeklySummary Reports
      await userProfile
        .find({ getWeeklyReport: true }, { email: 1, teamCode: 1, _id: 0 })
        // eslint-disable-next-line no-shadow
        .then((results) => {
          mappedResults = results.map((ele) => ele.email);
          mappedResults.push('onecommunityglobal@gmail.com', 'onecommunityhospitality@gmail.com');
          mappedResults = mappedResults.toString();
        });

      let emailBody = '<h2>Weekly Summaries for all active users:</h2>';

      const weeklySummaryNotProvidedMessage =
        '<div><b>Weekly Summary:</b> <span style="color: red;"> Not provided! </span> </div>';

      const weeklySummaryNotRequiredMessage =
        '<div><b>Weekly Summary:</b> <span style="color: green;"> Not required for this user </span></div>';

      results.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastname}`),
      );

      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        const {
          firstName,
          lastName,
          email,
          weeklySummaries,
          mediaUrl,
          adminLinks,
          weeklySummariesCount,
          weeklycommittedHours,
          weeklySummaryOption,
          teamCode,
        } = result;

        if (email !== undefined && email !== null) {
          emails.push(email);
        }

        const hoursLogged = result.totalSeconds[weekIndex] / 3600 || 0;

        const mediaUrlLink = mediaUrl ? `<a href="${mediaUrl}">${mediaUrl}</a>` : 'Not provided!';
        const teamCodeStr = teamCode ? `${teamCode}` : 'X-XXX';
        const googleDocLinkValue =
          adminLinks?.length > 0
            ? adminLinks.find((link) => link.Name === 'Google Doc' && link.Link)
            : null;

        const googleDocLink = googleDocLinkValue
          ? `<a href="${googleDocLinkValue.Link}">${googleDocLinkValue.Link}</a>`
          : null;

        let weeklySummaryMessage = weeklySummaryNotProvidedMessage;
        const colorStyle = (() => {
          switch (weeklySummaryOption) {
            case 'Team':
              return 'style="color: magenta;"';
            case 'Not Required':
              return 'style="color: green"';
            case 'Required':
              return '';
            default:
              return result.weeklySummaryNotReq ? 'style="color: green"' : '';
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
                  .tz('America/Los_Angeles')
                  .format('YYYY-MMM-DD')}</b>):
              </div>
              <div data-pdfmake="{&quot;margin&quot;:[20,0,20,0]}" ${colorStyle}>
                ${summary}
              </div>
            `;
          } else if (
            weeklySummaryOption === 'Not Required' ||
            (!weeklySummaryOption && result.weeklySummaryNotReq)
          ) {
            weeklySummaryMessage = weeklySummaryNotRequiredMessage;
          }
        }

        emailBody += `
        \n
        <div style="padding: 20px 0; margin-top: 5px; border-bottom: 1px solid #828282;">
          <b>Name:</b> ${firstName} ${lastName}
          <p>
          <b>Team Code:</b> ${teamCodeStr || 'X-XXX'}
          </p>
          <p>


            <b>Media URL:</b> ${mediaUrlLink || '<span style="color: red;">Not provided!</span>'}

          </p>
          <p>

          <b>Google Doc Link:</b> ${
            googleDocLink || '<span style="color: red;">Not provided!</span>'
          }

        </p>
          ${
            weeklySummariesCount === 8
              ? `<p style="color: blue;"><b>Total Valid Weekly Summaries: ${weeklySummariesCount}</b></p>`
              : `<p><b>Total Valid Weekly Summaries</b>: ${
                  weeklySummariesCount || 'No valid submissions yet!'
                }</p>`
          }
          ${
            hoursLogged >= weeklycommittedHours
              ? `<p><b>Hours logged</b>: ${hoursLogged.toFixed(2)} / ${weeklycommittedHours}</p>`
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
      while (emailString.includes(',')) {
        emailString = emailString.replace(',', '\n');
      }
      while (emailString.includes('\n')) {
        emailString = emailString.replace('\n', ', ');
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
        'Weekly Summaries for all active users...',
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
                dueDate: moment().tz('America/Los_Angeles').endOf('week'),
                summary: '',
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
      console.log('run');
      const currentFormattedDate = moment().tz('America/Los_Angeles').format();
      moment.tz('America/Los_Angeles').startOf('day').toISOString();

      logger.logInfo(
        `Job for assigning blue square for commitment not met starting at ${currentFormattedDate}`,
      );

      const pdtStartOfLastWeek = moment()
        .tz('America/Los_Angeles')
        .startOf('week')
        .subtract(1, 'week');

      const pdtEndOfLastWeek = moment().tz('America/Los_Angeles').endOf('week').subtract(1, 'week');

      const usersRequiringBlueSqNotification = [];

      /**
       * Manvitha :
       * - Added batch processing for assigning blue squares to users to ensure scalability and prevent MongoDB timeouts.
       * - Implemented sequential email queuing after all users are processed, to avoid reducing the risk of emails being marked as spam.
       */
      const emailQueue = [];
      const batchSize = 500;
      let skip = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const users = await userProfile
          .find({ isActive: true }, '_id weeklycommittedHours weeklySummaries missedHours')
          .skip(skip)
          .limit(batchSize);

        if (!users.length) break;

        await Promise.allSettled(
          users.map(async (user) => {
            try {
              const person = await userProfile.findById(user._id);
              const personId = mongoose.Types.ObjectId(user._id);

              let hasWeeklySummary = false;

              if (Array.isArray(user.weeklySummaries) && user.weeklySummaries.length) {
                const { summary } = user.weeklySummaries[0];
                if (summary) {
                  hasWeeklySummary = true;
                }
              }

              await processWeeklySummariesByUserId(personId);

              const results = await dashboardHelper.laborthisweek(
                personId,
                pdtStartOfLastWeek,
                pdtEndOfLastWeek,
              );

              const { timeSpent_hrs: timeSpent } = results[0];
              const weeklycommittedHours = user.weeklycommittedHours + (user.missedHours ?? 0);
              const timeNotMet = timeSpent < weeklycommittedHours;
              const timeRemaining = weeklycommittedHours - timeSpent;

              let isNewUser = false;
              const userStartDate = moment.tz(
                new Date(person.startDate).toISOString(),
                'America/Los_Angeles',
              );

              if (
                person.totalTangibleHrs === 0 &&
                person.totalIntangibleHrs === 0 &&
                timeSpent === 0 &&
                userStartDate.isAfter(pdtStartOfLastWeek)
              ) {
                console.log('1');
                isNewUser = true;
              }

              if (
                userStartDate.isAfter(pdtEndOfLastWeek) ||
                (userStartDate.isAfter(pdtStartOfLastWeek) &&
                  userStartDate.isBefore(pdtEndOfLastWeek) &&
                  timeUtils.getDayOfWeekStringFromUTC(person.startDate) > 1)
              ) {
                console.log('2');
                isNewUser = true;
              }

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
                updateResult?.weeklySummaryOption === 'Not Required' ||
                updateResult?.weeklySummaryNotReq
              ) {
                hasWeeklySummary = true;
              }

              const cutOffDate = moment().subtract(1, 'year');

              const oldInfringements = [];
              for (let k = 0; k < updateResult?.infringements.length; k += 1) {
                if (
                  updateResult?.infringements &&
                  moment(new Date(updateResult.infringements[k].date).toISOString()).diff(
                    cutOffDate,
                  ) >= 0
                ) {
                  oldInfringements.push(updateResult.infringements[k]);
                } else {
                  break;
                }
              }
              let historyInfringements = 'No Previous Infringements.';
              if (oldInfringements.length) {
                await userProfile.findByIdAndUpdate(
                  personId,
                  {
                    $push: {
                      oldInfringements: { $each: oldInfringements, $slice: -10 },
                    },
                  },
                  { new: true },
                );

                historyInfringements = oldInfringements
                  .map((item, index) => {
                    let enhancedDescription;
                    if (item.description) {
                      let sentences = item.description.split('.');
                      const dateRegex =
                        /in the week starting Sunday (\d{4})-(\d{2})-(\d{2}) and ending Saturday (\d{4})-(\d{2})-(\d{2})/g;
                      sentences = sentences.map((sentence) =>
                        sentence.replace(
                          dateRegex,
                          (match, year1, month1, day1, year2, month2, day2) => {
                            const startDate = moment(
                              `${year1}-${month1}-${day1}`,
                              'YYYY-MM-DD',
                            ).format('M-D-YYYY');
                            const endDate = moment(
                              `${year2}-${month2}-${day2}`,
                              'YYYY-MM-DD',
                            ).format('M-D-YYYY');
                            return `in the week starting Sunday ${startDate} and ending Saturday ${endDate}`;
                          },
                        ),
                      );
                      if (
                        sentences[0].includes('System auto-assigned infringement for two reasons')
                      ) {
                        sentences[0] = sentences[0].replace(
                          /(not meeting weekly volunteer time commitment as well as not submitting a weekly summary)/gi,
                          '<span style="color: blue;"><b>$1</b></span>',
                        );
                        enhancedDescription = sentences.join('.');
                        enhancedDescription = enhancedDescription.replace(
                          /logged (\d+(\.\d+)?\s*hours)/i,
                          'logged <span style="color: blue;"><b>$1</b></span>',
                        );
                      } else if (
                        sentences[0].includes(
                          'System auto-assigned infringement for editing your time entries',
                        )
                      ) {
                        sentences[0] = sentences[0].replace(
                          /time entries <(\d+)>\s*times/i,
                          'time entries <b>$1 times</b>',
                        );
                        enhancedDescription = sentences.join('.');
                      } else if (sentences[0].includes('System auto-assigned infringement')) {
                        sentences[0] = sentences[0].replace(
                          /(not submitting a weekly summary)/gi,
                          '<span style="color: blue;"><b>$1</b></span>',
                        );
                        sentences[0] = sentences[0].replace(
                          /(not meeting weekly volunteer time commitment)/gi,
                          '<span style="color: blue;"><b>$1</b></span>',
                        );
                        enhancedDescription = sentences.join('.');
                        enhancedDescription = enhancedDescription.replace(
                          /logged (\d+(\.\d+)?\s*hours)/i,
                          'logged <span style="color: blue;"><b>$1</b></span>',
                        );
                      } else {
                        enhancedDescription = `<span style="color: blue;"><b>${item.description}</b></span>`;
                      }
                    }
                    return `<p>${index + 1}. Date: <span style="color: blue;"><b>${moment(
                      item.date,
                    ).format('M-D-YYYY')}</b></span>, Description: ${enhancedDescription}</p>`;
                  })
                  .join('');
              }
              // No extra hours is needed if blue squares isn't over 5.
              // length +1 is because new infringement hasn't been created at this stage.
              const coreTeamExtraHour = Math.max(0, oldInfringements.length + 1 - 5);
              const utcStartMoment = moment(pdtStartOfLastWeek).add(1, 'second');
              const utcEndMoment = moment(pdtEndOfLastWeek)
                .subtract(1, 'day')
                .subtract(1, 'second');

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
                // eslint-disable-next-line prefer-destructuring
                requestForTimeOff = requestsForTimeOff[0];
                requestForTimeOffStartingDate = moment
                  .tz(requestForTimeOff.startingDate, 'America/Los_Angeles')
                  .format('dddd M-D-YYYY');

                requestForTimeOffEndingDate = moment
                  .tz(requestForTimeOff.endingDate, 'America/Los_Angeles')
                  .format('dddd  M-D-YYYY');
                requestForTimeOffreason = requestForTimeOff.reason;
                requestForTimeOffEmailBody = `<span style="color: blue;">You had scheduled time off From ${requestForTimeOffStartingDate}, To ${requestForTimeOffEndingDate}, due to: <b>${requestForTimeOffreason}</b></span>`;
              }
              let description = '';

              if (timeNotMet || !hasWeeklySummary) {
                if (hasTimeOffRequest) {
                  description = requestForTimeOffreason;
                } else if (timeNotMet && !hasWeeklySummary) {
                  if (person.role === 'Core Team') {
                    description = `System auto-assigned infringement for two reasons: not meeting weekly volunteer time commitment as well as not submitting a weekly summary. In the week starting ${pdtStartOfLastWeek.format(
                      'dddd M-D-YYYY',
                    )} and ending ${pdtEndOfLastWeek.format(
                      'dddd M-D-YYYY',
                    )}, you logged ${timeSpent.toFixed(2)} hours against a committed effort of ${
                      person.weeklycommittedHours
                    } hours + ${
                      person.missedHours ?? 0
                    } hours owed for last week + ${coreTeamExtraHour} hours owed for this being your ${moment
                      .localeData()
                      .ordinal(
                        oldInfringements.length + 1,
                      )} blue square. So you should have completed ${weeklycommittedHours + coreTeamExtraHour} hours and you completed ${timeSpent.toFixed(
                      2,
                    )} hours.`;
                  } else {
                    description = `System auto-assigned infringement for two reasons: not meeting weekly volunteer time commitment as well as not submitting a weekly summary. For the hours portion, you logged ${timeSpent.toFixed(
                      2,
                    )} hours against a committed effort of ${weeklycommittedHours} hours in the week starting ${pdtStartOfLastWeek.format(
                      'dddd M-D-YYYY',
                    )} and ending ${pdtEndOfLastWeek.format('dddd M-D-YYYY')}.`;
                  }
                } else if (timeNotMet) {
                  if (person.role === 'Core Team') {
                    description = `System auto-assigned infringement for not meeting weekly volunteer time commitment. In the week starting ${pdtStartOfLastWeek.format(
                      'dddd M-D-YYYY',
                    )} and ending ${pdtEndOfLastWeek.format(
                      'dddd M-D-YYYY',
                    )}, you logged ${timeSpent.toFixed(2)} hours against a committed effort of ${
                      user.weeklycommittedHours
                    } hours + ${
                      person.missedHours ?? 0
                    } hours owed for last week + ${coreTeamExtraHour} hours owed for this being your ${moment
                      .localeData()
                      .ordinal(
                        oldInfringements.length + 1,
                      )} blue square. So you should have completed ${weeklycommittedHours + coreTeamExtraHour} hours and you completed ${timeSpent.toFixed(
                      2,
                    )} hours.`;
                  } else {
                    description = `System auto-assigned infringement for not meeting weekly volunteer time commitment. You logged ${timeSpent.toFixed(
                      2,
                    )} hours against a committed effort of ${weeklycommittedHours} hours in the week starting ${pdtStartOfLastWeek.format(
                      'dddd M-D-YYYY',
                    )} and ending ${pdtEndOfLastWeek.format('dddd M-D-YYYY')}.`;
                  }
                } else {
                  description = `System auto-assigned infringement for not submitting a weekly summary for the week starting ${pdtStartOfLastWeek.format(
                    'dddd M-D-YYYY',
                  )} and ending ${pdtEndOfLastWeek.format('dddd M-D-YYYY')}.`;
                }

                const infringement = {
                  date: moment().utc().format('YYYY-MM-DD'),
                  description,
                  createdDate: hasTimeOffRequest
                    ? moment
                        .tz(
                          new Date(requestForTimeOff.createdAt).toISOString(),
                          'America/Los_Angeles',
                        )
                        .format('YYYY-MM-DD')
                    : null,
                };

                // Only assign blue square and send email if the user IS NOT a new user
                // Otherwise, display notification to users if new user && met the time requirement && weekly summary not submitted
                // All other new users will not receive a blue square or notification
                let emailBody = '';
                if (!isNewUser) {
                  const status = await userProfile.findByIdAndUpdate(
                    personId,
                    {
                      $push: {
                        infringements: infringement,
                      },
                    },
                    { new: true },
                  );
                  const administrativeContent = {
                    startDate: moment
                      .tz(new Date(person.startDate).toISOString(), 'America/Los_Angeles')
                      .utc()
                      .format('M-D-YYYY'),
                    role: person.role,
                    userTitle: person.jobTitle[0],
                    historyInfringements,
                  };
                  if (person.role === 'Core Team' && timeRemaining > 0) {
                    emailBody = getInfringementEmailBody(
                      status.firstName,
                      status.lastName,
                      infringement,
                      status.infringements.length,
                      timeRemaining,
                      coreTeamExtraHour,
                      requestForTimeOffEmailBody,
                      administrativeContent,
                      weeklycommittedHours,
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
                      administrativeContent,
                    );
                  }

                  let emailsBCCs;
                  /* eslint-disable array-callback-return */
                  const blueSquareBCCs = await BlueSquareEmailAssignment.find()
                    .populate('assignedTo')
                    .exec();
                  if (blueSquareBCCs.length > 0) {
                    emailsBCCs = blueSquareBCCs.map((assignment) => {
                      if (assignment.assignedTo.isActive === true) {
                        return assignment.email;
                      }
                    });
                  } else {
                    emailsBCCs = null;
                  }

                  emailSender(
                    status.email,
                    'New Infringement Assigned',
                    emailBody,
                    null,
                    ['onecommunityglobal@gmail.com', 'jae@onecommunityglobal.org'],
                    status.email,
                    [...new Set([...emailsBCCs])],
                  );
                } else if (isNewUser && !timeNotMet && !hasWeeklySummary) {
                  usersRequiringBlueSqNotification.push(personId);
                }

                const categories = await dashboardHelper.laborThisWeekByCategory(
                  personId,
                  pdtStartOfLastWeek,
                  pdtEndOfLastWeek,
                );

                if (!Array.isArray(categories) || categories.length === 0) return;

                await userProfile.findOneAndUpdate(
                  { _id: personId, categoryTangibleHrs: { $exists: false } },
                  { $set: { categoryTangibleHrs: [] } },
                );

                for (let j = 0; j < categories.length; j += 1) {
                  const elem = categories[j];

                  if (elem._id == null) {
                    elem._id = 'Other';
                  }

                  const updateResult2 = await userProfile.findOneAndUpdate(
                    { _id: personId, 'categoryTangibleHrs.category': elem._id },
                    { $inc: { 'categoryTangibleHrs.$.hrs': elem.timeSpent_hrs } },
                    { new: true },
                  );

                  if (!updateResult2) {
                    await userProfile.findOneAndUpdate(
                      {
                        _id: personId,
                        'categoryTangibleHrs.category': { $ne: elem._id },
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
              if (cache.hasCache(`user-${personId}`)) {
                cache.removeCache(`user-${personId}`);
              }
            } catch (err) {
              logger.logException(err);
            }
          }),
        );

        skip += batchSize;
      }

      for (const email of emailQueue) {
        await emailSender(
          email.to,
          email.subject,
          email.body,
          email.bcc,
          email.from,
          email.replyTo,
          email.attachments,
        );
      }

      await deleteOldTimeOffRequests();

      if (usersRequiringBlueSqNotification.length > 0) {
        const senderId = await userProfile.findOne({ role: 'Owner', isActive: true }, '_id');
        await notificationService.createNotification(
          senderId._id,
          usersRequiringBlueSqNotification,
          NEW_USER_BLUE_SQUARE_NOTIFICATION_MESSAGE,
          true,
          false,
        );
      }
    } catch (err) {
      logger.logException(err);
    }

    try {
      const inactiveUsers = await userProfile.find({ isActive: false }, '_id');
      for (let i = 0; i < inactiveUsers.length; i += 1) {
        const user = inactiveUsers[i];
        await processWeeklySummariesByUserId(mongoose.Types.ObjectId(user._id), false);
      }
    } catch (err) {
      logger.logException(err);
    }
  };

  const applyMissedHourForCoreTeam = async () => {
    try {
      const currentDate = moment().tz('America/Los_Angeles').format();

      logger.logInfo(
        `Job for applying missed hours for Core Team members starting at ${currentDate}`,
      );

      const startOfLastWeek = moment()
        .tz('America/Los_Angeles')
        .startOf('week')
        .subtract(1, 'week')
        .format('YYYY-MM-DD');

      const endOfLastWeek = moment()
        .tz('America/Los_Angeles')
        .endOf('week')
        .subtract(1, 'week')
        .format('YYYY-MM-DD');

      const missedHours = await userProfile.aggregate([
        {
          $match: {
            role: 'Core Team',
            isActive: true,
          },
        },
        {
          $lookup: {
            from: 'timeEntries',
            localField: '_id',
            foreignField: 'personId',
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$isTangible', true] },
                      { $gte: ['$dateOfWork', startOfLastWeek] },
                      { $lte: ['$dateOfWork', endOfLastWeek] },
                    ],
                  },
                },
              },
            ],
            as: 'timeEntries',
          },
        },
        {
          $project: {
            _id: 1,
            missedHours: {
              $let: {
                vars: {
                  baseMissedHours: {
                    $max: [
                      {
                        $subtract: [
                          {
                            $sum: [{ $ifNull: ['$missedHours', 0] }, '$weeklycommittedHours'],
                          },
                          {
                            $divide: [
                              {
                                $sum: {
                                  $map: {
                                    input: '$timeEntries',
                                    in: '$$this.totalSeconds',
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
                  infringementsAdjustment: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ['$infringements', null] },
                          { $gt: [{ $size: '$infringements' }, 5] },
                        ],
                      },
                      { $subtract: [{ $size: '$infringements' }, 5] },
                      0,
                    ],
                  },
                },
                in: {
                  $cond: [
                    { $gt: ['$$baseMissedHours', 0] },
                    { $add: ['$$baseMissedHours', '$$infringementsAdjustment'] },
                    '$$baseMissedHours',
                  ],
                },
              },
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
    const currentFormattedDate = moment().tz('America/Los_Angeles').format();

    logger.logInfo(
      `Job for deleting blue squares older than 1 year starting at ${currentFormattedDate}`,
    );

    const cutOffDate = moment().subtract(1, 'year').format('YYYY-MM-DD');

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

      logger.logInfo(`Job deleting blue squares older than 1 year finished
        at ${moment().tz('America/Los_Angeles').format()} \nReulst: ${JSON.stringify(results)}`);
    } catch (err) {
      logger.logException(err);
    }
  };

  const reActivateUser = async () => {
    const currentFormattedDate = moment().tz('America/Los_Angeles').format();

    logger.logInfo(
      `Job for activating users based on scheduled re-activation date starting at ${currentFormattedDate}`,
    );

    try {
      const users = await userProfile.find(
        { isActive: false, reactivationDate: { $exists: true } },
        '_id isActive reactivationDate',
      );
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];
        const canActivate = moment().isSameOrAfter(moment(user.reactivationDate));
        if (canActivate) {
          // Use '!' to invert the boolean value for testing
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
              .tz('America/Los_Angeles')
              .format()}.`,
          );
          const id = user._id;
          const person = await userProfile.findById(id);

          const endDate = moment(person.endDate).format('YYYY-MM-DD');
          logger.logInfo(`User with id: ${user._id} was re-acticated at ${moment().format()}.`);

          const subject = `IMPORTANT:${person.firstName} ${person.lastName} has been RE-activated in the Highest Good Network`;

          const emailBody = `<p> Hi Admin! </p>

          <p>This email is to let you know that ${person.firstName} ${person.lastName} has been made active again in the Highest Good Network application after being paused on ${endDate}.</p>

          <p>If you need to communicate anything with them, this is their email from the system: ${person.email}.</p>

          <p> Thanks! </p>

          <p>The HGN A.I. (and One Community)</p>`;

          emailSender('onecommunityglobal@gmail.com', subject, emailBody, null, null, person.email);
        }
      }
    } catch (err) {
      logger.logException(err);
    }
  };

  const notifyInfringements = async (
    original,
    current,
    firstName,
    lastName,
    emailAddress,
    role,
    startDate,
    jobTitle,
  ) => {
    if (!current) return;
    const newOriginal = original.toObject();
    const newCurrent = current.toObject();
    const totalInfringements = newCurrent.length;
    let newInfringements = [];
    let historyInfringements = 'No Previous Infringements.';
    if (original.length) {
      historyInfringements = original
        .map((item, index) => {
          let enhancedDescription;
          if (item.description) {
            let sentences = item.description.split('.');
            const dateRegex =
              /in the week starting Sunday (\d{4})-(\d{2})-(\d{2}) and ending Saturday (\d{4})-(\d{2})-(\d{2})/g;
            sentences = sentences.map((sentence) =>
              sentence.replace(dateRegex, (match, year1, month1, day1, year2, month2, day2) => {
                const startDate = moment(`${year1}-${month1}-${day1}`, 'YYYY-MM-DD').format(
                  'M-D-YYYY',
                );
                const endDate = moment(`${year2}-${month2}-${day2}`, 'YYYY-MM-DD').format(
                  'M-D-YYYY',
                );
                return `in the week starting Sunday ${startDate} and ending Saturday ${endDate}`;
              }),
            );
            if (sentences[0].includes('System auto-assigned infringement for two reasons')) {
              sentences[0] = sentences[0].replace(
                /(not meeting weekly volunteer time commitment as well as not submitting a weekly summary)/gi,
                '<span style="color: blue;"><b>$1</b></span>',
              );
              enhancedDescription = sentences.join('.');
              enhancedDescription = enhancedDescription.replace(
                /logged (\d+(\.\d+)?\s*hours)/i,
                'logged <span style="color: blue;"><b>$1</b></span>',
              );
            } else if (
              sentences[0].includes(
                'System auto-assigned infringement for editing your time entries',
              )
            ) {
              sentences[0] = sentences[0].replace(
                /time entries <(\d+)>\s*times/i,
                'time entries <b>$1 times</b>',
              );
              enhancedDescription = sentences.join('.');
            } else if (sentences[0].includes('System auto-assigned infringement')) {
              sentences[0] = sentences[0].replace(
                /(not submitting a weekly summary)/gi,
                '<span style="color: blue;"><b>$1</b></span>',
              );
              sentences[0] = sentences[0].replace(
                /(not meeting weekly volunteer time commitment)/gi,
                '<span style="color: blue;"><b>$1</b></span>',
              );
              enhancedDescription = sentences.join('.');
              enhancedDescription = enhancedDescription.replace(
                /logged (\d+(\.\d+)?\s*hours)/i,
                'logged <span style="color: blue;"><b>$1</b></span>',
              );
            } else {
              enhancedDescription = `<span style="color: blue;"><b>${item.description}</b></span>`;
            }
          }
          return `<p>${index + 1}. Date: <span style="color: blue;"><b>${moment(item.date).format('M-D-YYYY')}</b></span>, Description: ${enhancedDescription}</p>`;
        })
        .join('');
    }
    const administrativeContent = {
      startDate: moment(startDate).utc().format('M-D-YYYY'),
      role,
      userTitle: jobTitle,
      historyInfringements,
    };
    newInfringements = _.differenceWith(newCurrent, newOriginal, (arrVal, othVal) =>
      arrVal._id.equals(othVal._id),
    );

    const assignments = await BlueSquareEmailAssignment.find().populate('assignedTo').exec();
    const bccEmails = assignments.map((a) => a.email);
    newInfringements.forEach(async (element) => {
      emailSender(
        emailAddress,
        'New Infringement Assigned',
        getInfringementEmailBody(
          firstName,
          lastName,
          element,
          totalInfringements,
          undefined,
          undefined,
          undefined,
          administrativeContent,
        ),
        null,
        ['onecommunityglobal@gmail.com', 'jae@onecommunityglobal.org'],
        emailAddress,
        // Don't change this is to CC!
        [...new Set([...bccEmails])],
        null,
        ['onecommunityglobal@gmail.com', 'jae@onecommunityglobal.org'],
        emailAddress,
        // Don't change this is to CC!
        [...new Set([...bccEmails])],
      );
    });
  };

  const replaceBadge = async function (personId, oldBadgeId, newBadgeId) {
    userProfile.updateOne(
      { _id: personId, 'badgeCollection.badge': oldBadgeId },
      {
        $set: {
          'badgeCollection.$.badge': newBadgeId,
          'badgeCollection.$.lastModified': Date.now().toString(),
          'badgeCollection.$.count': 1,
          'badgeCollection.$.earnedDate': [earnedDateBadge()],
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
      { _id: personId, 'badgeCollection.badge': badgeId },
      {
        $inc: { 'badgeCollection.$.count': 1 },
        $set: { 'badgeCollection.$.lastModified': Date.now().toString() },
        $push: { 'badgeCollection.$.earnedDate': earnedDateBadge() },
      },
      (err) => {
        if (err) {
          console.log(err);
        }
      },
    );
  };

  const decreaseBadgeCount = async function (personId, badgeId) {
    try {
      const result = await userProfile.updateOne(
        { _id: personId, 'badgeCollection.badge': badgeId },
        {
          $inc: { 'badgeCollection.$.count': -1 },
          $set: { 'badgeCollection.$.lastModified': Date.now().toString() },
        },
      );
    } catch (error) {
      console.error('Error decrementing badge count:', error);
    }
  };

  const addBadge = async function (personId, badgeId, count = 1, featured = false) {
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
    await userProfile.findByIdAndUpdate(
      personId,
      {
        $pull: {
          badgeCollection: { badge: mongoose.Types.ObjectId(badgeId) },
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
          throw new Error(
            `Failed to update badge for ${personId}. Badge not found ${badgeId.toString()}`,
          );
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
          { _id: personId, 'badgeCollection.badge': badgeId },
          {
            $set: {
              'badgeCollection.$.count': count,
              'badgeCollection.$.lastModified': Date.now().toString(),
              'badgeCollection.$.earnedDate': newEarnedDate,
              'badgeCollection.$.hasBadgeDeletionImpact': recordToUpdate.count > count, // badge deletion impact set to true if the new count is less than the old count
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

  const removePrevHrBadge = async function (personId, user, badgeCollection, hrs, weeks) {
    // Check each Streak Greater than One to check if it works
    if (weeks < 2) {
      return;
    }
    let removed = false;
    await badge
      .aggregate([
        {
          $match: {
            type: 'X Hours for X Week Streak',
            weeks: { $gt: 0, $lt: weeks },
            totalHrs: hrs,
          },
        },
        { $sort: { weeks: -1, totalHrs: -1 } },
        {
          $group: {
            _id: '$weeks',
            badges: {
              $push: { _id: '$_id', hrs: '$totalHrs', weeks: '$weeks' },
            },
          },
        },
      ])
      .then((results) => {
        results.forEach((streak) => {
          streak.badges.every((bdge) => {
            for (let i = 0; i < badgeCollection.length; i += 1) {
              if (
                badgeCollection[i].badge?.type === 'X Hours for X Week Streak' &&
                badgeCollection[i].badge?.weeks === bdge.weeks &&
                badgeCollection[i].badge?.totalHrs === hrs &&
                !removed
              ) {
                changeBadgeCount(
                  personId,
                  badgeCollection[i].badge._id,
                  badgeCollection[i].count - 1,
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
  const checkNoInfringementStreak = async function (personId, user, badgeCollection) {
    let badgeOfType;
    for (let i = 0; i < badgeCollection.length; i += 1) {
      if (badgeCollection[i].badge?.type === 'No Infringement Streak') {
        if (badgeOfType && badgeOfType.months <= badgeCollection[i].badge.months) {
          removeDupBadge(personId, badgeOfType._id);
          badgeOfType = badgeCollection[i].badge;
        } else if (badgeOfType && badgeOfType.months > badgeCollection[i].badge.months) {
          removeDupBadge(personId, badgeCollection[i].badge._id);
        } else if (!badgeOfType) {
          badgeOfType = badgeCollection[i].badge;
        }
      }
    }
    await badge
      .find({ type: 'No Infringement Streak' })
      .sort({ months: -1 })
      .then((results) => {
        if (!Array.isArray(results) || !results.length) {
          return;
        }

        results.every((elem) => {
          // Cannot account for time paused yet

          if (elem.months <= 12) {
            if (moment().diff(moment(user.createdDate), 'months', true) >= elem.months) {
              if (
                user.infringements.length === 0 ||
                Math.abs(
                  moment().diff(
                    moment(
                      // eslint-disable-next-line no-unsafe-optional-chaining
                      user.infringements[user.infringements?.length - 1].date,
                    ),
                    'months',
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
            if (moment().diff(moment(user.createdDate), 'months', true) >= elem.months) {
              if (
                user.oldInfringements.length === 0 ||
                Math.abs(
                  moment().diff(
                    moment(
                      // eslint-disable-next-line no-unsafe-optional-chaining
                      user.oldInfringements[user.oldInfringements?.length - 1].date,
                    ),
                    'months',
                    true,
                  ),
                ) >=
                  elem.months - 12
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
  const checkMinHoursMultiple = async function (personId, user, badgeCollection) {
    const ratio = user.lastWeekTangibleHrs / user.weeklycommittedHours;

    const badgesOfType = badgeCollection
      .map((obj) => obj.badge)
      .filter((badge) => badge.type === 'Minimum Hours Multiple');

    const availableBadges = await badge
      .find({ type: 'Minimum Hours Multiple' })
      .sort({ multiple: -1 }); // Higher multiples come first

    if (!availableBadges.length) {
      return;
    }

    for (const candidateBadge of availableBadges) {
      if (ratio < candidateBadge.multiple) {
        continue;
      }

      const alreadyHasBadge = badgesOfType.find(
        (b) => b._id.toString() === candidateBadge._id.toString(),
      );

      if (alreadyHasBadge) {
        return increaseBadgeCount(personId, mongoose.Types.ObjectId(candidateBadge._id));
      }

      // Find lowest badge lower than candidate
      const lowerBadges = badgesOfType.filter((b) => b.multiple < candidateBadge.multiple);
      const lowestLowerBadge = lowerBadges.sort((a, b) => a.multiple - b.multiple)[0];

      if (lowestLowerBadge) {
        const entry = badgeCollection.find(
          (entry) => entry.badge._id.toString() === lowestLowerBadge._id.toString(),
        );

        if (entry?.count > 1) {
          await decreaseBadgeCount(personId, mongoose.Types.ObjectId(lowestLowerBadge._id));
        } else {
          await removeDupBadge(personId, mongoose.Types.ObjectId(lowestLowerBadge._id));
        }

        return addBadge(personId, mongoose.Types.ObjectId(candidateBadge._id));
      }

      return addBadge(personId, mongoose.Types.ObjectId(candidateBadge._id));
    }
  };

  const getAllWeeksData = async (personId, user) => {
    const userId = mongoose.Types.ObjectId(personId);
    const weeksData = [];
    const currentDate = moment().tz('America/Los_Angeles');
    const startDate = moment(user.createdDate).tz('America/Los_Angeles');
    const numWeeks = Math.ceil(currentDate.diff(startDate, 'days') / 7);

    // iterate through weeks to get hours of each week
    for (let week = 1; week <= numWeeks; week += 1) {
      const pdtstart = startDate
        .clone()
        .add(week - 1, 'weeks')
        .startOf('week')
        .format('YYYY-MM-DD');
      const pdtend = startDate.clone().add(week, 'weeks').subtract(1, 'days').format('YYYY-MM-DD');
      try {
        const results = await dashboardHelper.laborthisweek(userId, pdtstart, pdtend);
        const { timeSpent_hrs: timeSpent } = results[0];
        weeksData.push(timeSpent);
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
    return weeksData;
  };

  const getMaxHrs = async (personId, user) => {
    const weeksdata = await getAllWeeksData(personId, user);
    return Math.max(...weeksdata);
  };

  function mergeHours(array1, array2) {
    const tempHours = [...array1, ...array2];
    return tempHours;
  }

  const updatePersonalMax = async (personId, user) => {
    //
    try {
      const weeksData = await getAllWeeksData(personId, user);
      const savedHours = user.savedTangibleHrs;
      const result = mergeHours(savedHours, weeksData);
      const MaxHrs = Math.max(...result);
      user.personalBestMaxHrs = MaxHrs;
      await user.save();
    } catch (error) {
      console.error(error);
    }
  };

  // 'Personal Max',
  const checkPersonalMax = async function (personId, user, badgeCollection) {
    let badgeOfType;
    const duplicateBadges = [];
    const currentDate = moment().tz('America/Los_Angeles').format('MMM-DD-YY');

    const masterBadges = await badge.find({ type: 'Personal Max' });
    console.log(`[DEBUG] Found master badges: `);

    // Check for existing badge in badgeCollection
    for (let i = 0; i < badgeCollection.length; i += 1) {
      const b = badgeCollection[i];
      if (b.badge?.type === 'Personal Max') {
        console.log(`[DEBUG] Found Personal Max badge at index $`);
        if (!badgeOfType) {
          badgeOfType = b;
        } else {
          duplicateBadges.push(b);
          console.log(`[DEBUG] Found duplicate Personal Max badge:)}`);
        }
        break;
      }
    }

    // Remove duplicate badges
    for (const b of duplicateBadges) {
      // console.log(`[DEBUG] Removing duplicate badge with ID: ${b._id}`);
      await removeDupBadge(personId, b._id);
    }

    // Add new badge if missing
    if (!badgeOfType && masterBadges.length > 0) {
      const newBadgeId = masterBadges[0]._id;
      console.log(`[DEBUG] No existing badge found. Adding new badge ID: ${newBadgeId}`);
      await addBadge(personId, newBadgeId);
    }

    const lastWeek = user.lastWeekTangibleHrs;
    const savedHrs = user.savedTangibleHrs || [];
    const lastSaved = savedHrs[savedHrs.length - 1];
    const personalBest = user.personalBestMaxHrs;

    if (
      lastWeek &&
      lastSaved > lastWeek &&
      lastWeek >= personalBest &&
      !badgeOfType?.earnedDate?.includes(currentDate)
    ) {
      console.log(`[DEBUG] Conditions met to increase badge count`);
      if (badgeOfType) {
        await increaseBadgeCount(personId, mongoose.Types.ObjectId(badgeOfType.badge._id));
      }
    }

    console.log(`[DEBUG] Updating personal max...`);
    await updatePersonalMax(personId, user);
    console.log(`[DEBUG] checkPersonalMax complete for personId: ${personId}`);
  };

  // 'Most Hrs in Week'
  const checkMostHrsWeek = async function (personId, user, badgeCollection) {
    try {
      if (user.weeklycommittedHours > 0 && user.lastWeekTangibleHrs > user.weeklycommittedHours) {
        // Getting badge of type 'Most Hrs in Week'
        const results = await badge.findOne({ type: 'Most Hrs in Week' });
        if (!results) {
          console.error('No badge found for type "Most Hrs in Week"');
          return;
        }

        // Getting the max hours of all active users
        const userResults = await userProfile.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: null, maxHours: { $max: '$lastWeekTangibleHrs' } } },
        ]);

        if (!userResults || userResults.length === 0) {
          console.error('No user results found');
          return;
        }

        const maxHours = userResults[0].maxHours;

        if (user.lastWeekTangibleHrs && user.lastWeekTangibleHrs >= maxHours) {
          const existingBadge = badgeCollection.find(
            (object) => object.badge.type === 'Most Hrs in Week',
          );
          if (existingBadge) {
            // console.log('Increasing badge count');
            await increaseBadgeCount(personId, mongoose.Types.ObjectId(existingBadge.badge._id));
          } else {
            // console.log('Adding badge');
            await addBadge(personId, mongoose.Types.ObjectId(results._id));
          }
        }
      }
    } catch (error) {
      console.error('Error in checkMostHrsWeek:', error);
    }
  };
  // 'X Hours in one week',
  const checkXHrsInOneWeek = async function (personId, user, badgeCollection) {
    // Set lastWeek value
    const lastWeek = user.savedTangibleHrs[user.savedTangibleHrs.length - 1];

    const badgesOfType = [];
    for (let i = 0; i < badgeCollection.length; i += 1) {
      if (badgeCollection[i].badge?.type === 'X Hours for X Week Streak') {
        badgesOfType.push(badgeCollection[i].badge);
      }
    }

    await badge
      .find({ type: 'X Hours for X Week Streak', weeks: 1 })
      .sort({ totalHrs: -1 })
      .then((results) => {
        results.every((elem) => {
          const badgeName = `${elem.totalHrs} Hours in 1 Week`;

          if (elem.totalHrs === lastWeek) {
            let theBadge = null;
            for (let i = 0; i < badgesOfType.length; i += 1) {
              if (badgesOfType[i]._id.toString() === elem._id.toString()) {
                theBadge = badgesOfType[i]._id;
                break;
              }
            }

            if (theBadge) {
              increaseBadgeCount(personId, mongoose.Types.ObjectId(theBadge));
            } else {
              addBadge(personId, mongoose.Types.ObjectId(elem._id));
            }
            return false; // Exit the loop early
          }
          return true;
        });
      })
      .catch((error) => {
        console.error('Error while fetching badges or processing results:', error);
      });
  };

  // 'X Hours for X Week Streak',
  const checkXHrsForXWeeks = async (personId, user, badgeCollection) => {
    try {
      if (user.savedTangibleHrs.length === 0) {
        console.log('No tangible hours available.');
        return;
      }

      const savedTangibleHrs = user.savedTangibleHrs;
      const currentMaxHours = savedTangibleHrs[savedTangibleHrs.length - 1];
      let streak = 0;

      for (let i = savedTangibleHrs.length - 1; i >= 0; i -= 1) {
        if (savedTangibleHrs[i] === currentMaxHours) {
          streak += 1;
        } else {
          break;
        }
      }

      if (streak === 0) {
        console.log('No valid streak found.');
        return;
      }

      if (streak === 1) {
        await checkXHrsInOneWeek(personId, user, badgeCollection);
        return;
      }

      // Fetch matching badges
      const allBadges = await badge.find({
        badgeName: {
          $in: [
            `${currentMaxHours} HOURS ${streak}-WEEK STREAK`,
            `${currentMaxHours}-Hours Streak ${streak} Weeks in a Row`,
            `${currentMaxHours} Hours Streak ${streak}-WEEk STREAK`,
            `${currentMaxHours} Hours Streak ${streak}-WEEK STREAK`,
          ],
        },
      });

      if (allBadges.length === 0) {
        return;
      }

      const newBadge = allBadges[0];

      if (!badgeCollection || !Array.isArray(badgeCollection)) {
        return;
      }

      let badgeInCollection = null;
      for (let i = 0; i < badgeCollection.length; i += 1) {
        if (!badgeCollection[i] || !badgeCollection[i].badge) continue; // Skip invalid entries

        if (badgeCollection[i].badge.badgeName === newBadge.badgeName) {
          badgeInCollection = badgeCollection[i];
          break;
        }
      }

      if (badgeInCollection) {
        await increaseBadgeCount(personId, newBadge._id);
        return;
      }

      // Loop through badgeCollection to find and handle replacements or downgrades
      for (let j = badgeCollection.length - 1; j >= 0; j -= 1) {
        const lastBadge = badgeCollection[j];

        if (!lastBadge || !lastBadge.badge) {
          continue;
        }

        if (lastBadge.badge.totalHrs === currentMaxHours) {
          // Check if the badge is eligible for downgrade or replacement
          if (lastBadge.badge.weeks < streak && lastBadge.count > 1) {
            await decreaseBadgeCount(personId, lastBadge.badge._id);

            console.log(`Adding new badge: ${newBadge.badgeName}`);
            await addBadge(personId, newBadge._id);
            return;
          }

          if (lastBadge.badge.weeks < streak) {
            await userProfile.updateOne(
              { _id: personId, 'badgeCollection.badge': lastBadge.badge._id },
              {
                $set: {
                  'badgeCollection.$.badge': newBadge._id,
                  'badgeCollection.$.lastModified': Date.now().toString(),
                  'badgeCollection.$.count': 1,
                  'badgeCollection.$.earnedDate': [earnedDateBadge()],
                },
              },
            );
            return;
          }
        }
      }

      await addBadge(personId, newBadge._id);
    } catch (error) {
      console.error('Error in checkXHrsForXWeeks function:', error);
    }
  };

  // 'Lead a team of X+'

  const checkLeadTeamOfXplus = async function (personId, user, badgeCollection) {
    const leaderRoles = ['Mentor', 'Manager', 'Administrator', 'Owner', 'Core Team'];
    const approvedRoles = ['Mentor', 'Manager'];
    if (!approvedRoles.includes(user.role)) return;
    const teams = await getAllTeamMembers(personId);
    // Calculate total unique non-leader members across all teams
    const uniqueMembers = new Set();
    let totalNonLeaderMembers = 0;

    teams.forEach((team) => {
      // Filter out leaders and duplicates from each team
      const nonLeaderMembers = team.members.filter((member) => {
        if (leaderRoles.includes(member.role)) return false;
        if (uniqueMembers.has(member.userId.toString())) return false;
        uniqueMembers.add(member.userId.toString());
        return true;
      });
      totalNonLeaderMembers += nonLeaderMembers.length;
    });

    let badgeOfType;
    for (let i = 0; i < badgeCollection.length; i += 1) {
      if (badgeCollection[i].badge?.type === 'Lead a team of X+') {
        if (badgeOfType && badgeOfType.people <= badgeCollection[i].badge.people) {
          await removeDupBadge(personId, badgeOfType._id);
          badgeOfType = badgeCollection[i].badge;
        } else if (badgeOfType && badgeOfType.people > badgeCollection[i].badge.people) {
          await removeDupBadge(personId, badgeCollection[i].badge._id);
        } else if (!badgeOfType) {
          badgeOfType = badgeCollection[i].badge;
        }
      }
    }
    // Get all available team size badges, sorted by people count descending
    await badge
      .find({
        type: 'Lead a team of X+',
        people: { $lte: totalNonLeaderMembers }, // Only get badges where requirement is <= team size
      })
      .sort({ people: -1 }) // Sort descending
      .limit(1) // Get only the highest qualifying badge
      .then((results) => {
        if (!Array.isArray(results) || !results.length) return;

        const qualifyingBadge = results[0]; // This will be the 60+ badge for a team of 65

        if (badgeOfType) {
          // If user has an existing badge
          if (
            badgeOfType._id.toString() !== qualifyingBadge._id.toString() &&
            badgeOfType.people < qualifyingBadge.people
          ) {
            replaceBadge(
              personId,
              mongoose.Types.ObjectId(badgeOfType._id),
              mongoose.Types.ObjectId(qualifyingBadge._id),
            );
          }
        } else {
          // If user doesn't have a badge yet
          addBadge(personId, mongoose.Types.ObjectId(qualifyingBadge._id));
        }
      });
  };

  // 'Total Hrs in Category'
  const checkTotalHrsInCat = async function (personId, user, badgeCollection) {
    const hoursByCategory = user.hoursByCategory || {};
    const categories = [
      'food',
      'energy',
      'housing',
      'education',
      'society',
      'economics',
      'stewardship',
    ];

    for (const category of categories) {
      const categoryHrs = hoursByCategory[category];

      const newCatg = category.charAt(0).toUpperCase() + category.slice(1);
      const badgesInCat = badgeCollection.filter(
        (obj) => obj.badge?.type === 'Total Hrs in Category' && obj.badge?.category === newCatg,
      );

      let badgeOfType = badgesInCat.length ? badgesInCat[0].badge : null;

      // Only process one badge per category
      for (const current of badgesInCat) {
        const currBadge = current.badge;

        if (current.count > 1) {
          decreaseBadgeCount(personId, currBadge._id);
          addBadge(personId, currBadge._id);
          badgeOfType = currBadge;
          break;
        } else if (badgeOfType && badgeOfType.totalHrs > currBadge.totalHrs) {
          removeDupBadge(personId, currBadge._id);
        } else if (!badgeOfType) {
          badgeOfType = currBadge;
        }
      }

      const results = await badge
        .find({ type: 'Total Hrs in Category', category: newCatg })
        .sort({ totalHrs: -1 });

      if (!Array.isArray(results) || !results.length || !categoryHrs) {
        continue;
      }

      for (const elem of results) {
        if (categoryHrs >= 100 && categoryHrs >= elem.totalHrs) {
          const alreadyHas = badgesInCat.find(
            (b) => b.badge._id.toString() === elem._id.toString(),
          );

          if (alreadyHas) {
            increaseBadgeCount(personId, elem._id);
            break;
          }

          if (badgeOfType && badgeOfType.totalHrs < elem.totalHrs) {
            replaceBadge(personId, badgeOfType._id, elem._id);
            break;
          }

          if (!badgeOfType) {
            addBadge(personId, elem._id);
            break;
          }
        }
      }
    }
  };

  const getAllTeamMembers = async (userId) => {
    try {
      // Add match stage to filter teams containing the specified user
      const results = await Team.aggregate([
        {
          $match: {
            'members.userId': mongoose.Types.ObjectId(userId),
          },
        },
        // Unwind members to process each team member
        { $unwind: '$members' },
        {
          $lookup: {
            from: 'userProfiles',
            localField: 'members.userId',
            foreignField: '_id',
            as: 'userProfile',
          },
        },
        { $unwind: '$userProfile' },
        // Lookup badges
        {
          $lookup: {
            from: 'badges',
            localField: 'userProfile.badgeCollection.badge',
            foreignField: '_id',
            as: 'badgeDetails',
          },
        },
        // Group back by team to get team structure
        {
          $group: {
            _id: '$_id',
            teamName: { $first: '$teamName' },
            members: {
              $push: {
                userId: '$userProfile._id',
                role: '$userProfile.role',
                firstName: '$userProfile.firstName',
                lastName: '$userProfile.lastName',
                addDateTime: '$members.addDateTime',
                badgeCollection: {
                  $map: {
                    input: '$userProfile.badgeCollection',
                    as: 'badgeItem',
                    in: {
                      $mergeObjects: [
                        '$$badgeItem',
                        {
                          badge: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$badgeDetails',
                                  as: 'badge',
                                  cond: { $eq: ['$$badge._id', '$$badgeItem.badge'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      ]);

      return results; // Returns array of teams the user is in with all members
    } catch (error) {
      console.error('Error fetching team members:', error);
      throw error;
    }
  };

  const awardNewBadges = async () => {
    try {
      const users = await userProfile.find({ isActive: true }).populate('badgeCollection.badge');
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];
        const { _id, badgeCollection } = user;
        const personId = mongoose.Types.ObjectId(_id);

        await checkPersonalMax(personId, user, badgeCollection);
        await checkMostHrsWeek(personId, user, badgeCollection);
        await checkMinHoursMultiple(personId, user, badgeCollection);
        await checkTotalHrsInCat(personId, user, badgeCollection);
        await checkXHrsForXWeeks(personId, user, badgeCollection);
        await checkNoInfringementStreak(personId, user, badgeCollection);
        await checkLeadTeamOfXplus(personId, user, badgeCollection);
        // remove cache after badge asssignment.
        if (cache.hasCache(`user-${_id}`)) {
          cache.removeCache(`user-${_id}`);
        }
      }
    } catch (err) {
      console.log(err);
      logger.logException(err);
    }
  };

  const getTangibleHoursReportedThisWeekByUserId = function (personId) {
    const userId = mongoose.Types.ObjectId(personId);

    const pdtstart = moment().tz('America/Los_Angeles').startOf('week').format('YYYY-MM-DD');
    const pdtend = moment().tz('America/Los_Angeles').endOf('week').format('YYYY-MM-DD');

    return timeEntries
      .find(
        {
          personId: userId,
          dateOfWork: { $gte: pdtstart, $lte: pdtend },
          isTangible: true,
        },
        'totalSeconds',
      )
      .then((results) => {
        const totalTangibleWeeklySeconds = results.reduce(
          (acc, { totalSeconds }) => acc + totalSeconds,
          0,
        );
        return (totalTangibleWeeklySeconds / 3600).toFixed(2);
      });
  };

  const sendDeactivateEmailBody = function (
    firstName,
    lastName,
    endDate,
    email,
    recipients,
    isSet,
    reactivationDate,
    sendThreeWeeks,
    followup,
  ) {
    let subject;
    let emailBody;
    recipients.push('onecommunityglobal@gmail.com');
    recipients = recipients.toString();
    if (reactivationDate) {
      subject = `IMPORTANT: ${firstName} ${lastName} has been PAUSED in the Highest Good Network`;
      emailBody = `<p>Management, </p>

      <p>Please note that ${firstName} ${lastName} has been PAUSED in the Highest Good Network as ${moment(endDate).format('M-D-YYYY')}.</p>
      <p>For a smooth transition, Please confirm all your work with this individual has been wrapped up and nothing further is needed on their part until they return on ${moment(reactivationDate).format('M-D-YYYY')}. </p>

      <p>With Gratitude, </p>

      <p>One Community</p>`;
      emailSender(email, subject, emailBody, null, recipients, email);
    } else if (endDate && isSet && sendThreeWeeks) {
      const subject = `IMPORTANT: The last day for ${firstName} ${lastName} has been set in the Highest Good Network`;
      const emailBody = `<p>Management, </p>

      <p>Please note that the final day for ${firstName} ${lastName} has been set in the Highest Good Network as ${moment(endDate).format('M-D-YYYY')}.</p>
      <p>This is more than 3 weeks from now, but you should still start confirming all your work is being wrapped up with this individual and nothing further will be needed on their part after this date. </p>

      <p>An additional reminder email will be sent in their final 2 weeks.</p>

      <p>With Gratitude, </p>

      <p>One Community</p>`;
      emailSender(email, subject, emailBody, null, recipients, email);
    } else if (endDate && isSet && followup) {
      subject = `IMPORTANT: The last day for ${firstName} ${lastName} has been set in the Highest Good Network`;
      emailBody = `<p>Management, </p>

      <p>Please note that the final day for ${firstName} ${lastName} has been set in the Highest Good Network as ${moment(endDate).format('M-D-YYYY')}.</p>
      <p> This is coming up soon. For a smooth transition, please confirm all your work is wrapped up with this individual and nothing further will be needed on their part after this date. </p>

      <p>With Gratitude, </p>

      <p>One Community</p>`;
      emailSender(email, subject, emailBody, null, recipients, email);
    } else if (endDate && isSet) {
      subject = `IMPORTANT: The last day for ${firstName} ${lastName} has been set in the Highest Good Network`;
      emailBody = `<p>Management, </p>

      <p>Please note that the final day for ${firstName} ${lastName} has been set in the Highest Good Network as ${moment(endDate).format('M-D-YYYY')}.</p>
      <p> For a smooth transition, Please confirm all your work with this individual has been wrapped up and nothing further is needed on their part. </p>

      <p>With Gratitude, </p>

      <p>One Community</p>`;
      emailSender(email, subject, emailBody, null, recipients, email);
    } else if (endDate) {
      subject = `IMPORTANT: ${firstName} ${lastName} has been deactivated in the Highest Good Network`;
      emailBody = `<p>Management, </p>

      <p>Please note that ${firstName} ${lastName} has been made inactive in the Highest Good Network as ${moment(endDate).format('M-D-YYYY')}.</p>
      <p>For a smooth transition, Please confirm all your work with this individual has been wrapped up and nothing further is needed on their part. </p>

      <p>With Gratitude, </p>

      <p>One Community</p>`;
      emailSender(email, subject, emailBody, null, recipients, email);
    }
  };

  const deActivateUser = async () => {
    try {
      const emailReceivers = await userProfile.find(
        { isActive: true, role: { $in: ['Owner'] } },
        '_id isActive role email',
      );
      const recipients = emailReceivers.map((receiver) => receiver.email);
      const users = await userProfile.find(
        { isActive: true, endDate: { $exists: true } },
        '_id isActive endDate isSet finalEmailThreeWeeksSent reactivationDate',
      );
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];
        const { endDate, finalEmailThreeWeeksSent } = user;
        endDate.setHours(endDate.getHours() + 7);
        // notify reminder set final day before 2 weeks
        if (
          finalEmailThreeWeeksSent &&
          moment().isBefore(moment(endDate).subtract(2, 'weeks')) &&
          moment().isAfter(moment(endDate).subtract(3, 'weeks'))
        ) {
          const id = user._id;
          const person = await userProfile.findById(id);
          const lastDay = moment(person.endDate).format('YYYY-MM-DD');
          logger.logInfo(`User with id: ${user._id}'s final Day is set at ${moment().format()}.`);
          person.teams.map(async (teamId) => {
            const managementEmails = await userHelper.getTeamManagementEmail(teamId);
            if (Array.isArray(managementEmails) && managementEmails.length > 0) {
              managementEmails.forEach((management) => {
                recipients.push(management.email);
              });
            }
          });
          sendDeactivateEmailBody(
            person.firstName,
            person.lastName,
            lastDay,
            person.email,
            recipients,
            person.isSet,
            person.reactivationDate,
            false,
            true,
          );
        } else if (moment().isAfter(moment(endDate).add(1, 'days'))) {
          try {
            await userProfile.findByIdAndUpdate(
              user._id,
              user.set({
                isActive: false,
              }),
              { new: true },
            );
          } catch (err) {
            // Log the error and continue to the next user
            logger.logException(err, `Error in deActivateUser. Failed to update User ${user._id}`);
            continue;
          }
          const id = user._id;
          const person = await userProfile.findById(id);
          const lastDay = moment(person.endDate).format('YYYY-MM-DD');
          logger.logInfo(`User with id: ${user._id} was de-activated at ${moment().format()}.`);
          person.teams.map(async (teamId) => {
            const managementEmails = await userHelper.getTeamManagementEmail(teamId);
            if (Array.isArray(managementEmails) && managementEmails.length > 0) {
              managementEmails.forEach((management) => {
                recipients.push(management.email);
              });
            }
          });
          sendDeactivateEmailBody(
            person.firstName,
            person.lastName,
            lastDay,
            person.email,
            recipients,
            person.isSet,
            person.reactivationDate,
            undefined,
          );
        }
      }
    } catch (err) {
      logger.logException(err, 'Unexpected error in deActivateUser');
    }
  };

  // Update by Shengwei/Peter PR767:
  /**
   *  Delete all tokens used in new user setup from database that in cancelled, expired, or used status.
   *  Data retention: 90 days
   */
  const deleteExpiredTokens = async () => {
    const ninetyDaysAgo = moment().subtract(90, 'days').toDate();
    try {
      await token.deleteMany({ isCancelled: true, expiration: { $lt: ninetyDaysAgo } });
    } catch (error) {
      /* eslint-disable no-undef */
      logger.logException(error, `Error in deleteExpiredTokens. Date ${currentDate}`);
    }
  };

  const deleteOldTimeOffRequests = async () => {
    const endOfLastWeek = moment().tz('America/Los_Angeles').endOf('week').subtract(1, 'week');

    const utcEndMoment = moment(endOfLastWeek).subtract(1, 'day').add(1, 'second');
    try {
      await timeOffRequest.deleteMany({ endingDate: { $lte: utcEndMoment } });
    } catch (error) {
      logger.logException(
        error,
        `Error deleting expired time-off requests: utcEndMoment ${utcEndMoment}`,
      );
    }
  };

  function searchForTermsInFields(data, term1, term2) {
    const lowerCaseTerm1 = term1.toLowerCase();
    const lowerCaseTerm2 = term2.toLowerCase();

    const bothTermsMatches = [];
    const term2Matches = [];

    // Check if the current data is an array
    if (Array.isArray(data)) {
      data.forEach((item) => {
        const bothTermsFound = searchForBothTerms(item, lowerCaseTerm1, lowerCaseTerm2);
        // const term2OnlyFound = searchForTerm2(item, lowerCaseTerm2);

        if (bothTermsFound) {
          bothTermsMatches.push(item); // If both terms are found, store the item
        }
        // else if (term2OnlyFound) {
        //     term2Matches.push(item); // If only term2 is found, store the item
        // }
      });

      // If matches for both terms are found, return them, else return term2 matches
      if (bothTermsMatches.length > 0) {
        return bothTermsMatches;
      }
      //  else if (term2Matches.length > 0) {
      //     return term2Matches;
      // }

      return []; // No match found, return empty array
    }

    // Recursion case for nested objects
    if (typeof data === 'object' && data !== null) {
      const result = Object.keys(data).some((key) => {
        if (typeof data[key] === 'object') {
          return searchForTermsInFields(data[key], lowerCaseTerm1, lowerCaseTerm2);
        }
      });
      return result ? data : null;
    }
    return [];
  }

  // Helper function to check if both terms are in the string
  function searchForBothTerms(data, term1, term2) {
    if (typeof data === 'object' && data !== null) {
      const fieldsToCheck = ['src', 'alt', 'title', 'nitro_src'];
      return Object.keys(data).some((key) => {
        if (fieldsToCheck.includes(key)) {
          const stringValue = String(data[key]).toLowerCase();
          return stringValue.includes(term1) && stringValue.includes(term2); // Check if both terms are in the string
        }
        return false;
      });
    }
    return false;
  }

  // Helper function to check if only term2 is in the string
  function searchForTerm2(data, term2) {
    if (typeof data === 'object' && data !== null) {
      const fieldsToCheck = ['src', 'alt', 'title', 'nitro_src'];
      return Object.keys(data).some((key) => {
        if (fieldsToCheck.includes(key)) {
          const stringValue = String(data[key]).toLowerCase();
          return stringValue.includes(term2); // Check if only term2 is in the string
        }
        return false;
      });
    }
    return false;
  }

  async function getCurrentTeamCode(teamId) {
    if (!mongoose.Types.ObjectId.isValid(teamId)) return null;

    const result = await userProfile.aggregate([
      { $match: { teams: mongoose.Types.ObjectId(teamId), isActive: true } },
      { $limit: 1 },
      { $project: { teamCode: 1 } },
    ]);

    return result.length > 0 ? result[0].teamCode : null;
  }

  async function checkTeamCodeMismatch(user) {
    try {
      if (!user || !user.teams.length) {
        return false;
      }

      const latestTeamId = user.teams[0];
      const teamCodeFromFirstActive = await getCurrentTeamCode(latestTeamId);
      if (!teamCodeFromFirstActive) {
        return false;
      }

      return teamCodeFromFirstActive !== user.teamCode;
    } catch (error) {
      logger.logException(error);
      return false;
    }
  }

  async function imageUrlToPngBase64(url, maxSizeKB = 45) {
    try {
      // Fetch the image as a buffer
      const response = await axios.get(url, { responseType: 'arraybuffer' });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch the image: ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(response.data);

      let quality = 100; // Start with max quality
      let width = 1200; // Start with a reasonable large width
      let pngBuffer = await sharp(imageBuffer).resize({ width }).png({ quality }).toBuffer();
      let imageSizeKB = pngBuffer.length / 1024; // Convert bytes to KB

      // Try to optimize while keeping best quality
      while (imageSizeKB > maxSizeKB) {
        if (quality > 10) {
          quality -= 5; // Reduce quality gradually
        } else {
          width = Math.max(100, Math.round(width * 0.9)); // Reduce width gradually
        }

        pngBuffer = await sharp(imageBuffer)
          .resize({ width }) // Adjust width
          .png({ quality }) // Adjust quality
          .toBuffer();

        imageSizeKB = pngBuffer.length / 1024;
      }

      // Convert to Base64 and return
      return `data:image/png;base64,${pngBuffer.toString('base64')}`;
    } catch (error) {
      console.error(`An error occurred: ${error.message}`);
      return null;
    }
  }

  const fetchWithRetry = async (url, maxRetries = 2, delayTime = 300000) => {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        const response = await axios.get(url);
        return response.data; // Return data if the request succeeds
      } catch (error) {
        attempts += 1;
        // console.error(`Attempt ${attempts} failed: ${error.message}`);
        if (attempts >= maxRetries) throw new Error(`Failed after ${maxRetries} attempts`);
        // console.log(`Retrying in ${delayTime / 1000} seconds...`);
        await delay(delayTime); // Wait for 5 minutes
      }
    }
  };

  const getProfileImagesFromWebsite = async () => {
    try {
      // Fetch the webpage with retry logic
      const htmlText = await fetchWithRetry('https://www.onecommunityglobal.org/team');
      // Load HTML into Cheerio
      const $ = cheerio.load(htmlText);
      const imgData = [];
      $('img').each((i, img) => {
        imgData.push({
          src: $(img).attr('src'),
          alt: $(img).attr('alt'),
          title: $(img).attr('title'),
          nitro_src: $(img).attr('nitro-lazy-src'),
          data_src: $(img).attr('data-src'),
        });
      });
      const users = await userProfile.find(
        { isActive: true, bioPosted: 'posted' },
        'firstName lastName email profilePic suggestedProfilePics',
      );

      await Promise.all(
        users.map(async (u) => {
          if (!u.profilePic) {
            const result = searchForTermsInFields(imgData, u.firstName, u.lastName);
            try {
              if (result.length === 1) {
                if (result[0].nitro_src !== undefined && result[0].nitro_src !== null) {
                  await userProfile.updateOne(
                    { _id: u._id },
                    { $set: { profilePic: result[0].nitro_src } },
                  );
                } else {
                  const images = result[0].src.startsWith('http')
                    ? result[0].src
                    : result[0].data_src;
                  const image = await imageUrlToPngBase64(images);
                  await userProfile.updateOne({ _id: u._id }, { $set: { profilePic: image } });
                }
              }
            } catch (error) {
              console.error(`Error updating user ${u._id}:`, error);
            }
          }
        }),
      );
    } catch (error) {
      console.error('Failed to fetch profile images:', error);
    }
  };

  const resendBlueSquareEmailsOnlyForLastWeek = async () => {
    try {
      console.log('[Manual Resend] Starting email-only blue square resend...');

      const startOfLastWeek = moment()
        .tz('America/Los_Angeles')
        .startOf('week')
        .subtract(1, 'week')
        .toDate();
      const endOfLastWeek = moment()
        .tz('America/Los_Angeles')
        .endOf('week')
        .subtract(1, 'week')
        .toDate();

      const usersWithInfringements = await userProfile.find({
        infringements: {
          $elemMatch: {
            date: {
              $gte: moment(startOfLastWeek).format('YYYY-MM-DD'),
              $lte: moment(endOfLastWeek).format('YYYY-MM-DD'),
            },
          },
        },
        isActive: true,
      });

      for (const user of usersWithInfringements) {
        const infringement = user.infringements.find((inf) =>
          moment(inf.date).isBetween(startOfLastWeek, endOfLastWeek, null, '[]'),
        );
        if (!infringement) continue;

        // Fetch weekly logs for this user
        const timeLogs = await TimeLog.find({
          userId: user._id,
          date: { $gte: startOfLastWeek, $lte: endOfLastWeek },
        });

        const totalSeconds = timeLogs.reduce((acc, log) => acc + (log.totalSeconds || 0), 0);
        const hoursLogged = totalSeconds / 3600;
        const weeklycommittedHours = user.weeklyComittedHours || 0;
        const timeRemaining = Math.max(weeklycommittedHours - hoursLogged, 0);

        const administrativeContent = {
          startDate: moment(user.startDate).format('M-D-YYYY'),
          role: user.role,
          userTitle: user.jobTitle?.[0] || 'Volunteer',
          historyInfringements: 'Previously assigned blue square – resend only.',
        };

        let emailBody;
        if (user.role === 'Core Team' && timeRemaining > 0) {
          emailBody = getInfringementEmailBody(
            user.firstName,
            user.lastName,
            infringement,
            user.infringements.length,
            timeRemaining,
            0, // Assuming coreTeamExtraHour is not needed here or is 0
            null,
            administrativeContent,
            weeklycommittedHours,
          );
        } else {
          emailBody = getInfringementEmailBody(
            user.firstName,
            user.lastName,
            infringement,
            user.infringements.length,
            undefined,
            null,
            null,
            administrativeContent,
          );
        }

        const blueSquareBCCs = await BlueSquareEmailAssignment.find().populate('assignedTo').exec();
        const emailsBCCs = blueSquareBCCs.filter((b) => b.assignedTo?.isActive).map((b) => b.email);

        await emailSender(
          user.email,
          '[RESEND] Blue Square Notification',
          emailBody,
          null,
          ['onecommunityglobal@gmail.com', 'jae@onecommunityglobal.org'],
          user.email,
          [...new Set(emailsBCCs)],
        );
      }

      console.log('[Manual Resend] Emails successfully resent for existing blue squares.');
    } catch (err) {
      console.error('[Manual Resend] Error while resending:', err);
      logger.logException(err);
    }
  };

  return {
    changeBadgeCount,
    getUserName,
    getTeamMembers,
    getTeamManagementEmail,
    validateProfilePic,
    assignBlueSquareForTimeNotMet,
    applyMissedHourForCoreTeam,
    deleteBlueSquareAfterYear,
    reActivateUser,
    sendDeactivateEmailBody,
    deActivateUser,
    notifyInfringements,
    getInfringementEmailBody,
    emailWeeklySummariesForAllUsers,
    awardNewBadges,
    checkXHrsForXWeeks,
    getTangibleHoursReportedThisWeekByUserId,
    deleteExpiredTokens,
    deleteOldTimeOffRequests,
    getProfileImagesFromWebsite,
    checkTeamCodeMismatch,
    resendBlueSquareEmailsOnlyForLastWeek,
  };
};

module.exports = userHelper;
