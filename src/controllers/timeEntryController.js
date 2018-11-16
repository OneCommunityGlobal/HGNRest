const moment = require('moment-timezone');
const mongoose = require('mongoose');

const formatseconds = function (seconds) {
  const formattedseconds = parseInt(seconds, 10);
  const values = `${Math.floor(moment.duration(formattedseconds, 'seconds').asHours())}:${moment.duration(formattedseconds, 'seconds').minutes()}`;
  return values.split(':');
};

const timeEntrycontroller = function (TimeEntry) {
  const getAllTimeEnteries = function (req, res) {
    TimeEntry.find((err, records) => {
      if (err) {
        return res.status(404).send(err);
      }
      const items = [];
      records.forEach((element) => {
        const timeentry = new TimeEntry();
        timeentry.personId = element.personId;
        timeentry.projectId = element.projectId;
        timeentry.dateOfWork = element.dateOfWork;
        timeentry.timeSpent = moment('1900-01-01 00:00:00').add(element.totalSeconds, 'seconds').format('HH:mm:ss');
        timeentry.notes = element.notes;
        timeentry.isTangible = element.isTangible;
        items.push(timeentry);
      });
      return res.json(items).status(200);
    });
  };

  const postTimeEntry = function (req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.body.personId) || !mongoose.Types.ObjectId.isValid(req.body.projectId) || !req.body.dateOfWork || !moment(req.body.dateOfWork).isValid() || !req.body.timeSpent || !req.body.isTangible) {
      res.status(400).send({ error: 'Bad request' });
      return;
    }
    const timeentry = new TimeEntry();
    const { dateOfWork, timeSpent } = req.body;
    timeentry.personId = req.body.personId;
    timeentry.projectId = req.body.projectId;
    timeentry.dateOfWork = moment(dateOfWork).format('YYYY-MM-DD');
    timeentry.totalSeconds = moment.duration(timeSpent).asSeconds();
    timeentry.notes = req.body.notes;
    timeentry.isTangible = req.body.isTangible;
    timeentry.createdDateTime = moment().utc().toISOString();
    timeentry.lastModifiedDateTime = moment().utc().toISOString();

    timeentry.save()
      .then((results) => { res.status(200).send({ message: `Time Entry saved with id as ${results._id}` }); })
      .catch(error => res.status(400).send(error));
  };


  const getTimeEntriesForSpecifiedPeriod = function (req, res) {
    if (!req.params || !req.params.fromdate || !req.params.todate || !req.params.userId || !moment(req.params.fromdate).isValid() || !moment(req.params.toDate).isValid()) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }

    const fromdate = moment(req.params.fromdate).format('YYYY-MM-DD');
    const todate = moment(req.params.todate).format('YYYY-MM-DD');
    const { userId } = req.params;


    TimeEntry.find({
      personId: userId,
      dateOfWork: { $gte: fromdate, $lte: todate },
    },
    (' -createdDateTime'))
      .populate('projectId')
      .sort({ lastModifiedDateTime: -1 })
      .then((results) => {
        const data = [];
        results.forEach((element) => {
          const record = {};

          record._id = element._id;
          record.notes = element.notes;
          record.isTangible = element.isTangible;
          record.personId = element.personId;
          record.projectId = (element.projectId) ? element.projectId._id : '';
          record.projectName = (element.projectId) ? element.projectId.projectName : '';
          record.dateOfWork = element.dateOfWork;
          [record.hours, record.minutes] = formatseconds(element.totalSeconds);
          data.push(record);
        });
        res.status(200).send(data);
      })
      .catch(error => res.status(400).send(error));
  };
  const getTimeEntriesForSpecifiedProject = function (req, res) {
    if (!req.params || !req.params.fromDate || !req.params.toDate || !req.params.projectId) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }
    const todate = moment(req.params.toDate).format('YYYY-MM-DD');
    const fromDate = moment(req.params.fromDate).format('YYYY-MM-DD');
    const { projectId } = req.params;
    TimeEntry.find({
      projectId,
      dateOfWork: { $gte: fromDate, $lte: todate },
    },
    ('-createdDateTime -lastModifiedDateTime'))
      .populate('userId')
      .sort({ dateOfWork: -1 })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch(error => res.status(400).send(error));
  };


  const editTimeEntry = function (req, res) {
    // Verify request body

    if (!req.params.timeEntryId) {
      res.status(400).send({ error: 'ObjectId in request param is not in correct format' });
      return;
    }


    if (!mongoose.Types.ObjectId.isValid(req.params.timeEntryId)
            || !mongoose.Types.ObjectId.isValid(req.body.projectId)) {
      res.status(400).send({ error: 'ObjectIds are not correctly formed' });
      return;
    }

    TimeEntry.findById(req.params.timeEntryId)
      .then((record) => {
        if (!record) {
          res.status(400).send({ error: `No valid records found for ${req.params.timeEntryId}` });
          return;
        }

        const hours = (req.body.hours) ? req.body.hours : '00';
        const minutes = (req.body.minutes) ? req.body.minutes : '00';

        const timeSpent = `${hours}:${minutes}`;
        // verify that requestor is owner of timeentry or an administrator

        if (record.personId.toString() === req.body.requestor.requestorId.toString() || req.body.requestor.role === 'Administrator') {
          record.notes = req.body.notes;
          record.totalSeconds = moment.duration(timeSpent).asSeconds();
          record.isTangible = req.body.isTangible;
          record.lastModifiedDateTime = moment().utc().toISOString();
          record.projectId = mongoose.Types.ObjectId(req.body.projectId);
          if (req.body.requestor.role === 'Administrator') {
            record.dateOfWork = moment(req.body.dateOfWork).format('YYYY-MM-DD');
          }

          record.save()
            .then(() => res.status(200).send({ message: 'Successfully updated time entry' }))
            .catch(error => res.status(500).send({ error }));
        } else {
          res.status(403).send({ error: 'Unauthorized request' });
        }
      })
      .catch(error => res.status(400).send({ error }));
  };

  const deleteTimeEntry = function (req, res) {
    if (!req.params.timeEntryId) {
      res.status(400).send({ error: 'Bad request' });
      return;
    }

    TimeEntry.findById(req.params.timeEntryId)
      .then((record) => {
        if (!record) {
          res.status(400).send({ message: 'No valid record found' });
          return;
        }

        if (record.personId.toString() === req.body.requestor.requestorId.toString() || req.body.requestor.role === 'Administrator') {
          record.remove()
            .then(() => {
              res.status(200).send({ message: 'Successfully deleted' });
            })
            .catch((error) => {
              res.status(500).send(error);
            });
        } else {
          res.status(403).send({ error: 'Unauthorized request' });
        }
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };


  return {
    getAllTimeEnteries,
    postTimeEntry,
    getTimeEntriesForSpecifiedPeriod,
    editTimeEntry,
    deleteTimeEntry,
    getTimeEntriesForSpecifiedProject,
  };
};

module.exports = timeEntrycontroller;
