const mongoose = require('mongoose');
const moment = require('moment-timezone');
const _ = require('lodash');
const userProfile = require('../models/userProfile');
const myteam = require('../helpers/helperModels/myTeam');
const dashboardhelper = require('../helpers/dashboardhelper')();

const emailSender = require('../utilities/emailSender');

const logger = require('../startup/logger');

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
   * A week is represented by a number weekIndex: 0, 1 or 2, where 0 is the most recent and 2 the oldest. The weekIndex represents
   * the index of the weeklySummary array stored in the database, weeklySummary[0], weeklySummary[1] and weeklySummary[2].
   * The checkDate parameter can also be used to check whether the dueDate of the summary belongs to the week being checked.
   * There could be edge cases where a user's account has been inactive for a period of time then when activated again
   * they'll have summaries stored in the database with much older dates. If checkDate is set to "false" those older summaries
   * will also be counted based on the index of the week being checked, otherwise they will not be included in the email
   * as the dates won't be matching.
   *
   * @param {int}     weekIndex Numbered representation of a week where 0 is the most recent and 2 the oldest.
   * @param {boolean} checkDate Whether to check if the dueDate of the summary belongs to the week being checked.
   *
   * @return {void}
   */
  const emailWeeklySummaryForAllUsers = function (weekIndex, checkDate = false) {
    weekIndex = (weekIndex !== null) ? weekIndex : 0;

    const isDateBetween = (dueDate) => {
      const pstStartOfWeek = moment().tz('America/Los_Angeles').startOf('week').subtract(weekIndex, 'week');
      const pstEndOfWeek = moment().tz('America/Los_Angeles').endOf('week').subtract(weekIndex, 'week');
      const fromDate = moment(pstStartOfWeek).toDate();
      const toDate = moment(pstEndOfWeek).toDate();
      return moment(dueDate).isBetween(fromDate, toDate, undefined, '[]');
    };

    userProfile
      .find(
        {
          isActive: true,
        },
        '_id firstName lastName weeklySummary mediaUrl',
      )
      .then((users) => {
        let emailBody = '<h2>Weekly Summaries for all active users:</h2>';
        const weeklySummaryNotProvidedMessage = '<div><b>Weekly Summary:</b> Not provided!</div>';

        users.forEach((user) => {
          const {
            firstName, lastName, weeklySummary, mediaUrl,
          } = user;

          const mediaUrlLink = mediaUrl ? `<a href="${mediaUrl}">${mediaUrl}</a>` : 'Not provided!';
          let weeklySummaryMessage = weeklySummaryNotProvidedMessage;
          if (Array.isArray(weeklySummary) && weeklySummary.length && weeklySummary[weekIndex]) {
            const { dueDate, summary } = weeklySummary[weekIndex];
            if (summary) {
              weeklySummaryMessage = `<p><b>Weekly Summary</b> (for the week ending on ${moment(dueDate).format('YYYY-MM-DD')}):</p>
                                      <div style="padding: 0 20px;">${summary}</div>`;
              if (checkDate && !isDateBetween(dueDate)) {
                weeklySummaryMessage = weeklySummaryNotProvidedMessage;
              }
            }
          }

          emailBody += `\n
            <div style="padding: 20px 0; margin-top: 5px; border-bottom: 1px solid #828282;">
              <b>Name:</b> ${firstName} ${lastName}:
              <p><b>Media URL:</b> ${mediaUrlLink}</p>
              ${weeklySummaryMessage}
            </div>`;
        });

        emailSender(
          'onecommunityglobal@gmail.com',
          'Weekly Summaries for all active users...',
          emailBody,
          null,
        );
      })
      .catch(error => logger.logException(error));
  };


  const processWeeklySummaryByUserId = function (personId) {
    userProfile
      .findByIdAndUpdate(personId, {
        $push: {
          weeklySummary: {
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
      }, { new: true })
      .then(result => logger.logInfo(result.weeklySummary))
      .catch(error => logger.logException(error));
  };

  const assignBlueBadges = function () {
    logger.logInfo(
      `Job for assigning blue badge for commitment not met starting at ${moment()
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
        '_id weeklySummary',
      )
      .then((users) => {
        users.forEach((user) => {
          const {
            _id, weeklySummary,
          } = user;
          const personId = mongoose.Types.ObjectId(_id);

          let hasWeeklySummary = false;
          if (Array.isArray(weeklySummary) && weeklySummary.length) {
            const { dueDate, summary } = weeklySummary[0];
            const fromDate = moment(pdtStartOfLastWeek).toDate();
            const toDate = moment(pdtEndOfLastWeek).toDate();
            if (summary && moment(dueDate).isBetween(fromDate, toDate, undefined, '[]')) {
              hasWeeklySummary = true;
            }
          }

          //  This needs to run AFTER the check for weekly summary above because the summaries array will be updated/shifted to make room for a new summary for the new week.
          processWeeklySummaryByUserId(personId);

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
                  })
                  .catch(error => logger.logException(error));
              }
            })
            .catch(error => logger.logException(error));
        });
      })
      .catch(error => logger.logException(error));
  };

  const deleteBadgeAfterYear = function () {
    logger.logInfo(
      `Job for deleting badges older than 1 year starting at ${moment()
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
      emailSender(
        emailAddress,
        'New Infringment Assigned',
        getInfringmentEmailBody(firstName, lastName, element, totalInfringements),
        null,
        'onecommunityglobal@gmail.com',
      );
    });
  };

  return {
    getUserName,
    getTeamMembers,
    validateprofilepic,
    assignBlueBadges,
    deleteBadgeAfterYear,
    notifyInfringments,
    getInfringmentEmailBody,
    emailWeeklySummaryForAllUsers,
  };
};

module.exports = userhelper;
