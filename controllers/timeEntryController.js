var express = require('express');
var moment = require('moment-timezone');
var mongoose = require('mongoose');

var timeEntrycontroller = function (TimeEntry) {

    var getAllTimeEnteries = function (req, res) {

        TimeEntry.find(function (err, records) {

            if (err) {
                res.status(404).send(error);
            }
            else {
                var items = [];
                records.forEach(element => {

                    var timeentry = new TimeEntry();

                    timeentry.personId = element.personId;
                    timeentry.projectId = element.projectId;
                    timeentry.dateofWork = element.dateofWork;
                    timeentry.timeSpent = moment("1900-01-01 00:00:00").add(element.totalSeconds, 'seconds').format("HH:mm:ss");
                    timeentry.notes = element.notes;
                    timeentry.isTangible = element.isTangible;

                    items.push(timeentry);
                });
                res.json(items).status(200);

            }
        });
    };

    var postTimeEntry = function (req, res) {


        if (!mongoose.Types.ObjectId.isValid(req.body.personId) || !mongoose.Types.ObjectId.isValid(req.body.projectId) || !req.body.dateofWork || !moment(req.body.dateofWork).isValid() || !req.body.timeSpent || !req.body.isTangible) {
            res.status(400).send({ "error": "Bad request" });
            return;
        }
        var timeentry = new TimeEntry();
        var dateofWork = req.body.dateofWork;
        var timeSpent = req.body.timeSpent;

        timeentry.personId = req.body.personId;
        timeentry.projectId = req.body.projectId;
        timeentry.dateofWork = moment(dateofWork).utc().format();
        timeentry.totalSeconds = moment.duration(timeSpent).asSeconds();
        timeentry.notes = req.body.notes;
        timeentry.isTangible = req.body.isTangible;
        timeentry.createdDateTime = moment().utc().toISOString();
        timeentry.lastModifiedDateTime = moment().utc().toISOString();
        timeentry.rollupYear = moment(dateofWork).get('year');
        timeentry.rollupMonth = ("0" + (moment(dateofWork).get('month') + 1)).slice(-2) + moment(dateofWork).get('year');
        timeentry.rollupWeek = moment(dateofWork).startOf('isoWeek').format("MM/DD/YYYY");

        timeentry.save()
            .then(results => { res.status(200).send({ message: `Time Entry saved with id as ${results._id}` }) })
            .catch(error => res.status(400).send(error));
    };

    var getTimeEntriesForSpecifiedPeriod = function (req, res) {

        if (!req.params || !req.params.fromdate || !req.params.todate || !req.params.userId || !moment(req.params.fromdate).isValid() || !moment(req.params.toDate).isValid()) {
            res.status(400).send({ "error": "Invalid request" });
            return;
        }



        let fromdate = moment(req.params.fromdate).startOf('day').utc().format();
        let todate = moment(req.params.todate).endOf('day').utc().format();
        let userId = req.params.userId;


        TimeEntry.find({
            "personId": userId,
            "dateofWork": { "$gte": fromdate, "$lte": todate }
        },
            ("-rollupYear -rollupMonth -rollupWeek  -createdDateTime"))
            .populate('projectId')
            .sort({ "lastModifiedDateTime": -1 })
            .then(results => {
                let data = [];
                results.forEach(element => {
                    let record = {};

                    record._id = element._id;
                    record.notes = element.notes;
                    record.isTangible = element.isTangible;
                    record.personId = element.personId;
                    record.projectId = (element.projectId) ? element.projectId._id : "";
                    record.projectName = (element.projectId) ? element.projectId.projectName : "";
                    record.dateOfWork = element.dateofWork;
                    record.hours = formatseconds(element.totalSeconds)[0];
                    record.minutes = formatseconds(element.totalSeconds)[1];

                    data.push(record);
                });
                res.status(200).send(data);
            })
            .catch(error => {
                console.log(error);
                res.status(400).send(error);
            }
            )


    };

    var formatseconds = function (seconds) {
        seconds = parseInt(seconds);
        var values = Math.floor(moment.duration(seconds, 'seconds').asHours()) + ':' + moment.duration(seconds, 'seconds').minutes();
        return values.split(":");
    };

    var editTimeEntry = function (req, res) {

        //Verify request body

        if (!req.params.timeEntryId) {
            res.status(400).send({ "error": "ObjectId in request param is not in correct format" });
            return;
        }

        //verify that requestor is owner of timeentry or an administrator


        if (!mongoose.Types.ObjectId.isValid(req.params.timeEntryId) ||
            !mongoose.Types.ObjectId.isValid(req.body.projectId)) {
            res.status(400).send({ "error": `ObjectIds are not correctly formed` });
            return;
        }

        TimeEntry.findById(req.params.timeEntryId)
            .then(record => {

                if (!record) {
                    res.status(400).send({ "error": `No valid records found for ${timeEntryId}` });
                    return;
                }

                let hours = (req.body.hours) ? req.body.hours : "00";
                let minutes = (req.body.minutes) ? req.body.minutes : "00";

                let timeSpent = hours + ":" + minutes;

                if (record.personId.toString() === req.body.requestor.requestorId.toString() || req.body.requestor.role === "Administrator") {

                    record.notes = req.body.notes;
                    record.totalSeconds = moment.duration(timeSpent).asSeconds();
                    record.isTangible = req.body.isTangible;
                    record.lastModifiedDateTime = moment().utc().toISOString();
                    record.projectId = mongoose.Types.ObjectId(req.body.projectId);
                    record.save()
                        .then(() => {
                            res.status(200).send({ "message": "Successfully updated time entry" })
                            return;
                        })
                        .catch((error) => {
                            res.status(500).send({ "error": error });
                            return;
                        }
                        );

                }
                else {
                    res.status(403).send({ "error": "Unauthorized request" });
                    return;
                }
            })
            .catch((error) => res.status(400).send({ error }));

    };

    var deleteTimeEntry = function (req, res) {
        if (!req.params.timeEntryId) {
            res.status(400).send({ "error": "Bad request" });
            return;
        }

        TimeEntry.findById(req.params.timeEntryId)
            .then((record) => {


                if (!record) {
                    res.status(400).send({ "message": "No valid record found" })
                    return;
                }

                if (record.personId.toString() === req.body.requestor.requestorId.toString() || req.body.requestor.role === "Administrator") {

                    record.remove()
                        .then(() => {
                            res.status(200).send({ "message": "Successfully deleted" })
                            return;
                        })
                        .catch((error) => {
                            res.status(500).send(error);
                            return;
                        }
                        );

                }
                else {
                    res.status(403).send({ "error": "Unauthorized request" });
                    return;
                }

            })
            .catch(error => {
                res.status(400).send(error);
                return;
            })



    }


    return {
        getAllTimeEnteries: getAllTimeEnteries,
        postTimeEntry: postTimeEntry,
        getTimeEntriesForSpecifiedPeriod: getTimeEntriesForSpecifiedPeriod,
        editTimeEntry: editTimeEntry,
        deleteTimeEntry: deleteTimeEntry

    };
};

module.exports = timeEntrycontroller;