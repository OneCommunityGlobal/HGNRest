const reporthelper = require('../helpers/reporthelper')();
const hasPermission = require('../utilities/permissions');

const reportsController = function () {
  const getWeeklySummaries = function (req, res) {
    if (!hasPermission(req.body.requestor.role, 'getWeeklySummaries')) {
      res.status(403).send('You are not authorized to view all users');
      return;
    }

    const weeklySummaries = reporthelper.weeklySummaries(2, 0);
    weeklySummaries
      .then((results) => {
        const summaries = reporthelper.formatSummaries(results);
        res.status(200).send(summaries);
      })
      .catch(error => res.status(404).send(error));
  };

  return {
    getWeeklySummaries,
  };
};

module.exports = reportsController;
