const { CronJob } = require('cron');
const moment = require('moment-timezone');
const userhelper = require('../helpers/userHelper')();

const userProfileJobs = () => {
  /* eslint-disable no-unused-vars */
  // 1: Minute (0-59)
  // 2: Hour (0-23)
  // 3: Day of Month (1-31)
  // 4: Month (0-11)
  // 5: Day of Week (0-6) (0 is Sunday)
  const allUserProfileJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    '0 0 * * 0', // Every Sunday, 12 AM.
    async () => {
      // Each step is isolated. These jobs are unrelated to each other, and
      // previously a throw in any of them silently took every later one with
      // it, awardNewBadges included, which is why the Lead Team Badge was
      // never assigned. Nothing surfaced because the rejection was unhandled
      // inside a cron callback. summaryNotSubmittedJobs below already guards
      // itself this way, it just does so for the whole callback at once; per
      // job is what keeps one failure from hiding the others.
      const run = async (name, job) => {
        try {
          await job();
        } catch (error) {
          console.error(`Error during ${name}:`, error);
        }
      };

      const SUNDAY = 0;
      if (moment().tz('America/Los_Angeles').day() === SUNDAY) {
        await run('getProfileImagesFromWebsite', userhelper.getProfileImagesFromWebsite);
        await run('assignBlueSquareForTimeNotMet', userhelper.assignBlueSquareForTimeNotMet);
        await run('applyMissedHourForCoreTeam', userhelper.applyMissedHourForCoreTeam);
        await run('emailWeeklySummariesForAllUsers', userhelper.emailWeeklySummariesForAllUsers);
        await run('deleteBlueSquareAfterYear', userhelper.deleteBlueSquareAfterYear);
        await run('deleteExpiredTokens', userhelper.deleteExpiredTokens);
      }
      await run('awardNewBadges', userhelper.awardNewBadges);
      // await userhelper.weeklyCompanySummaryEmail(); - function does not exist, restore when added
    },
    null,
    false,
    'America/Los_Angeles',
  );

  // 1: Minute (0-59)
  // 2: Hour (0-23)
  // 3: Day of Month (1-31)
  // 4: Month (0-11)
  // 5: Day of Week (0-6) (0 is Sunday)
  const summaryNotSubmittedJobs = new CronJob(
    '0 4 * * 0', // Every Sunday at 4AM
    async () => {
      try {
        console.log(
          'Starting summaryNotSubmittedJobs at:',
          moment().tz('America/Los_Angeles').format(),
        );
        await userhelper.completeHoursAndMissedSummary();
        await userhelper.weeklyAutoReplyEmailFunction(); // replaces inCompleteHoursEmailFunction + weeklyBlueSquareReminderFunction
        // Below calls will be removed once the combined function WeeklyAutoReplyEmailFunction is fully working in production
        // await userhelper.inCompleteHoursEmailFunction();
        // await userhelper.weeklyBlueSquareReminderFunction();
      } catch (error) {
        console.error('Error during summaryNotSubmittedJobs:', error);
      }
    },
    null,
    false,
    'America/Los_Angeles',
  );

  // Job to run every day, 1 minute past midnight to deactivate the user
  // 1: Minute (0-59)
  // 2: Hour (0-23)
  // 3: Day of Month (1-31)
  // 4: Month (0-11)
  // 5: Day of Week (0-6) (0 is Sunday)
  const dailyUserDeactivateJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    '1 0 * * *', // Every day, 1 minute past midnight
    async () => {
      await userhelper.reactivateUser();
      await userhelper.finalizeUserEndDates();
    },
    null,
    false,
    'America/Los_Angeles',
  );
  allUserProfileJobs.start();
  dailyUserDeactivateJobs.start();
  summaryNotSubmittedJobs.start();
};
module.exports = userProfileJobs;
