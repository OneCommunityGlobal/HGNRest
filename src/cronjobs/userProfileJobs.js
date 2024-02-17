const { CronJob } = require("cron");
const moment = require("moment-timezone");

const userhelper = require("../helpers/userHelper")();

const userProfileJobs = () => {
  console.log("I am called");
  const allUserProfileJobs = new CronJob(
    // '* * * * *', // Comment out for testing. Run Every minute.
    "1 0 * * 0", // Every Sunday, 1 minute past midnight.
    async () => {
      const THURSDAY = 4;
      if (moment().tz("America/Los_Angeles").day() === THURSDAY) {
        await userhelper.assignBlueSquareForTimeNotMet();
        await userhelper.applyMissedHourForCoreTeam();
        await userhelper.emailWeeklySummariesForAllUsers();
        await userhelper.deleteBlueSquareAfterYear();
        await userhelper.deleteExpiredTokens();
      }
      await userhelper.awardNewBadges();
      await userhelper.reActivateUser();
      await userhelper.deActivateUser();
    },
    null,
    false,
    "America/Los_Angeles"
  );
  console.log("I am called");
  allUserProfileJobs.start();
};
module.exports = userProfileJobs;
