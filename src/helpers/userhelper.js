const mongoose = require('mongoose');
const moment = require('moment-timezone');
const _ = require('lodash');
const userProfile = require('../models/userProfile');
const myteam = require('../helpers/helperModels/myTeam');
const dashboardhelper = require('../helpers/dashboardhelper')();
const reporthelper = require('../helpers/reporthelper')();

const emailSender = require('../utilities/emailSender');

const logger = require('../startup/logger');

let timeoutMS = 0;

const userhelper = function () {
  const getTeamMembers = function (user) {
    const userid = mongoose.Types.ObjectId(user._id);
    // var teamid = userdetails.teamId;
    return myteam.findById(userid).select({
      'myteam._id': 1,
      'myteam.role': 1,
      'myteam.fullName': 1,
      _id: 0,
    });
  };

  const getUserName = async function (userId) {
    const userid = mongoose.Types.ObjectId(userId);
    return userProfile.findById(userid, 'firstName lastName');
  };

  const validateprofilepic = function (profilePic) {
    const picParts = profilePic.split('base64');
    let result = true;
    const errors = [];

    if (picParts.length < 2) {
      return {
        result: false,
        errors: 'Invalid image',
      };
    }

    // validate size
    const imagesize = picParts[1].length;
    const sizeInBytes = (4 * Math.ceil(imagesize / 3) * 0.5624896334383812) / 1024;

    if (sizeInBytes > 50) {
      errors.push('Image size should not exceed 50KB');
      result = false;
    }

    const imagetype = picParts[0].split('/')[1];
    if (imagetype !== 'jpeg;' && imagetype !== 'png;') {
      errors.push('Image type shoud be either jpeg or png.');
      result = false;
    }

    return {
      result,
      errors,
    };
  };

  const getInfringmentEmailBody = function (firstName, lastName, infringment, totalInfringements) {
    const text = `Dear <b>${firstName} ${lastName}</b>,
        <p>Oops, it looks like something happened and you’ve managed to get a blue square.</p>
        <p><b>Date Assigned:</b> ${infringment.date}</p>
        <p><b>Description:</b> ${infringment.description}</p>
        <p><b>Total Infringements:</b> This is your <b>${moment.localeData().ordinal(totalInfringements)}</b> blue square of 5.</p>
        <p>Life happens and we understand that. That’s why we allow 5 of them before taking action. This action usually includes removal from our team though, so please let your direct supervisor know what happened and do your best to avoid future blue squares if you are getting close to 5 and wish to avoid termination. Each blue square drops off after a year.</p>
        <p>Thank you,<br />
        One Community</p>`;

    return text;
  };


  /**
   * This function will send out an email listing all users that have a summary provided for a specific week.
   * A week is represented by an weekIndex: 0, 1 or 2, where 0 is the most recent and 2 the oldest.
   * It relies on the function weeklySummaries(startWeekIndex, endWeekIndex) to get the weekly summaries for the specific week.
   * In this case both the startWeekIndex and endWeekIndex are set to 1 to get the last weeks' summaries for all users.
   *
   * @param {int} weekIndex Numbered representation of a week where 0 is the most recent and 2 the oldest.
   *
   * @return {void}
   */
  const emailWeeklySummariesForAllUsers = function (weekIndex) {
    logger.logInfo(
      `Job for emailing all users' weekly summaries starting at ${moment().tz('America/Los_Angeles').format()}`,
    );

    weekIndex = (weekIndex !== null) ? weekIndex : 1;

    reporthelper
      .weeklySummaries(weekIndex, weekIndex)
      .then((results) => {
        let emailBody = '<h2>Weekly Summaries for all active users:</h2>';
        const weeklySummaryNotProvidedMessage = '<div><b>Weekly Summary:</b> Not provided!</div>';

        results.forEach((result) => {
          const {
            firstName, lastName, weeklySummaries, mediaUrl, weeklySummariesCount,
          } = result;

          const mediaUrlLink = mediaUrl ? `<a href="${mediaUrl}">${mediaUrl}</a>` : 'Not provided!';
          const totalValidWeeklySummaries = weeklySummariesCount || 'No valid submissions yet!';
          let weeklySummaryMessage = weeklySummaryNotProvidedMessage;
          // weeklySummaries array should only have one item if any, hence weeklySummaries[0] needs be used to access it.
          if (Array.isArray(weeklySummaries) && weeklySummaries.length && weeklySummaries[0]) {
            const { dueDate, summary } = weeklySummaries[0];
            if (summary) {
              weeklySummaryMessage = `<p><b>Weekly Summary</b> (for the week ending on ${moment(dueDate).tz('America/Los_Angeles').format('YYYY-MM-DD')}):</p>
                                        <div style="padding: 0 20px;">${summary}</div>`;
            }
          }

          emailBody += `\n
          <div style="padding: 20px 0; margin-top: 5px; border-bottom: 1px solid #828282;">
          <b>Name:</b> ${firstName} ${lastName}
          <p><b>Media URL:</b> ${mediaUrlLink}</p>
          <p><b>Total Valid Weekly Summaries:</b> ${totalValidWeeklySummaries}</p>
          ${weeklySummaryMessage}
          </div>`;
        });
        if (process.env.sendEmail) {
          emailSender(
            'onecommunityglobal@gmail.com',
            'Weekly Summaries for all active users...',
            emailBody,
            null,
          );
        }
      })
      .catch(error => logger.logException(error));
  };


  /**
   * This function will process the weeklySummaries array in the following way:
   *  1 ) Push a new (blank) summary at the beginning of the array.
   *  2 ) Always maintains 3 items in the array where each item represents a summary for a given week.
   *
   * This function will also increment the weeklySummariesCount by 1 if the user had provided a valid summary.
   *
   * @param {ObjectId} personId This is mongoose.Types.ObjectId object.
   * @param {boolean} hasWeeklySummary Whether the user with personId has submitted a valid weekly summary.
   */
  const processWeeklySummariesByUserId = function (personId, hasWeeklySummary) {
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
            $slice: 3,
          },
        },
      })
      .then(() => {
        if (hasWeeklySummary) {
          userProfile
            .findByIdAndUpdate(personId, {
              $inc: { weeklySummariesCount: 1 },
            }, { new: true })
            // .then(result => console.log('result:', result))
            .catch(error => logger.logException(error));
        }
      })
      .catch(error => logger.logException(error));
  };

  /**
   * This function is called by a cron job to do 3 things to all active users:
   *  1 ) Determine whether there's been an infringement for the weekly summary for last week.
   *  2 ) Determine whether there's been an infringement for the time not met for last week.
   *  3 ) Call the processWeeklySummariesByUserId(personId) to process the weeklySummaries array
   *      and increment the weeklySummariesCount for valud submissions.
   */
  const assignBlueSquareforTimeNotMet = function () {
    timeoutMS = 0;
    logger.logInfo(
      `Job for assigning blue square for commitment not met starting at ${moment()
        .tz('America/Los_Angeles')
        .format()}`,
    );
    const pdtStartOfLastWeek = moment()
      .tz('America/Los_Angeles')
      .startOf('week')
      .subtract(1, 'week');
    const pdtEndOfLastWeek = moment()
      .tz('America/Los_Angeles')
      .endOf('week')
      .subtract(1, 'week');
    userProfile
      .find(
        {
          isActive: true,
        },
        '_id weeklySummaries',
      )
      .then((users) => {
        users.forEach((user) => {
          const {
            _id, weeklySummaries,
          } = user;
          const personId = mongoose.Types.ObjectId(_id);

          let hasWeeklySummary = false;
          if (Array.isArray(weeklySummaries) && weeklySummaries.length) {
            const { dueDate, summary } = weeklySummaries[0];
            const fromDate = moment(pdtStartOfLastWeek).toDate();
            const toDate = moment(pdtEndOfLastWeek).toDate();
            if (summary && moment(dueDate).isBetween(fromDate, toDate, undefined, '[]')) {
              hasWeeklySummary = true;
            }
          }

          //  This needs to run AFTER the check for weekly summary above because the summaries array will be updated/shifted after this function runs.
          processWeeklySummariesByUserId(personId, hasWeeklySummary);

          dashboardhelper
            .laborthisweek(personId, pdtStartOfLastWeek, pdtEndOfLastWeek)
            .then((results) => {
              const { weeklyComittedHours, timeSpent_hrs: timeSpent } = results[0];
              const timeNotMet = (timeSpent < weeklyComittedHours);
              let description;

              if (timeNotMet || !hasWeeklySummary) {
                if (timeNotMet && !hasWeeklySummary) {
                  description = `System auto-assigned infringement for two reasons: not meeting weekly volunteer time commitment as well as not submitting a weekly summary. For the hours portion, you logged ${timeSpent} hours against committed effort of ${weeklyComittedHours} hours in the week starting ${pdtStartOfLastWeek.format('dddd YYYY-MM-DD')} and ending ${pdtEndOfLastWeek.format('dddd YYYY-MM-DD')}.`;
                } else if (timeNotMet) {
                  description = `System auto-assigned infringement for not meeting weekly volunteer time commitment. You logged ${timeSpent} hours against committed effort of ${weeklyComittedHours} hours in the week starting ${pdtStartOfLastWeek.format('dddd YYYY-MM-DD')} and ending ${pdtEndOfLastWeek.format('dddd YYYY-MM-DD')}.`;
                } else {
                  description = `System auto-assigned infringement for not submitting a weekly summary for the week starting ${pdtStartOfLastWeek.format('dddd YYYY-MM-DD')} and ending ${pdtEndOfLastWeek.format('dddd YYYY-MM-DD')}.`;
                }

                const infringment = {
                  date: moment()
                    .utc()
                    .format('YYYY-MM-DD'),
                  description,
                };

                userProfile
                  .findByIdAndUpdate(personId, {
                    $push: {
                      infringments: infringment,
                    },
                  }, { new: true })
                  .then((status) => {
                    if (process.env.sendEmail) {
                      timeoutMS += 500;
                      setTimeout(() => {
                        emailSender(
                          status.email,
                          'New Infringment Assigned',
                          getInfringmentEmailBody(
                            status.firstName,
                            status.lastName,
                            infringment,
                            status.infringments.length,
                          ),
                          null,
                          'onecommunityglobal@gmail.com',
                        );
                      }, timeoutMS);
                    }
                  })
                  .catch(error => logger.logException(error));
              }
            })
            .catch(error => logger.logException(error));
        });
      })
      .catch(error => logger.logException(error));
  };

  const deleteBlueSquareAfterYear = function () {
    logger.logInfo(
      `Job for deleting blue squares older than 1 year starting at ${moment()
        .tz('America/Los_Angeles')
        .format()}`,
    );
    const cutOffDate = moment()
      .subtract(1, 'year')
      .format('YYYY-MM-DD');
    userProfile
      .updateMany(
        {},
        {
          $pull: {
            infringments: {
              date: {
                $lte: cutOffDate,
              },
            },
          },
        },
      )
      .then(results => logger.logInfo(results))
      .catch(error => logger.logException(error));
  };

  const reActivateUser = function () {
    logger.logInfo(
      `Job for activating users based on scheduled re-activation date starting at ${moment().tz('America/Los_Angeles').format()}`,
    );
    userProfile
      .find({ isActive: false, reactivationDate: { $exists: true } }, '_id isActive reactivationDate')
      .then((users) => {
        users.forEach((user) => {
          if (moment.tz(moment(), 'America/Los_Angeles').isSame(moment.tz(user.reactivationDate, 'UTC'), 'day')) {
            userProfile.findByIdAndUpdate(
              user._id,
              {
                $set: {
                  isActive: true,
                },
              }, { new: true },
            )
              .then(() => {
                logger.logInfo(`User with id: ${user._id} was re-acticated at ${moment().tz('America/Los_Angeles').format()}.`);
              })
              .catch(error => logger.logException(error));
          }
        });
      })
      .catch(error => logger.logException(error));
  };

  const notifyInfringments = function (
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
    let newInfringments = [];
    newInfringments = _.differenceWith(
      newCurrent,
      newOriginal,
      (arrVal, othVal) => arrVal._id.equals(othVal._id),
    );
    newInfringments.forEach((element) => {
      if (process.env.sendEmail) {
        emailSender(
          emailAddress,
          'New Infringment Assigned',
          getInfringmentEmailBody(firstName, lastName, element, totalInfringements),
          null,
          'onecommunityglobal@gmail.com',
        );
      }
    });
  };

  return {
    getUserName,
    getTeamMembers,
    validateprofilepic,
    assignBlueSquareforTimeNotMet,
    deleteBlueSquareAfterYear,
    reActivateUser,
    notifyInfringments,
    getInfringmentEmailBody,
    emailWeeklySummariesForAllUsers,
  };
};

module.exports = userhelper;
