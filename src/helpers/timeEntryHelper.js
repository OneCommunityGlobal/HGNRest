const moment = require('moment-timezone');
const timeEntry = require('../models/timeentry');

const timeEntryHelper = function () {
  const getAllHoursLoggedForSpecifiedProject = function (projectId) {
    const fromDate = moment('1900-01-01 00:00:00').format('YYYY-MM-DD');
    const toDate = moment().tz('America/Los_Angeles').endOf('week').format('YYYY-MM-DD');
    return timeEntry.find(
      {
        projectId,
        dateOfWork: { $gte: fromDate, $lte: toDate },
        isTangible: true,
      },
      '-createdDateTime -lastModifiedDateTime',
    )
      .then((results) => {
        const totalSecondsLogged = results.reduce((acc, { totalSeconds }) => acc + totalSeconds, 0);
        return (totalSecondsLogged / 3600).toFixed(2);
      });
  };

  return {
    getAllHoursLoggedForSpecifiedProject,
  };
};

module.exports = timeEntryHelper;
