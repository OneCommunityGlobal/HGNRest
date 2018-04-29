var express = require('express');
var moment = require('moment');
var userProject = require('../helpers/helperModels/userProjects');
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


        if (!mongoose.Types.ObjectId.isValid(req.body.personId) || !mongoose.Types.ObjectId.isValid(req.body.projectId) || !req.body.dateofWork || !req.body.timeSpent || !req.body.isTangible) {
            res.status(400).send({ "error": "Bad request" });
            return;
        }
        var timeentry = new TimeEntry();
        var dateofWork = new Date(req.body.dateofWork);
        var date = new Date();
        var timeSpent = req.body.timeSpent;

        timeentry.personId = req.body.personId;
        timeentry.projectId = req.body.projectId;
        timeentry.dateofWork = moment(dateofWork);
        timeentry.totalSeconds = moment.duration(timeSpent).asSeconds();
        timeentry.notes = req.body.notes;
        timeentry.isTangible = req.body.isTangible;
        timeentry.createdDateTime = moment.utc();
        timeentry.lastModifiedDateTime = moment.utc();
        timeentry.rollupYear = moment(dateofWork).get('year');
        timeentry.rollupMonth = ("0" + (moment(dateofWork).get('month') + 1)).slice(-2) + moment(dateofWork).get('year');
        timeentry.rollupWeek = moment(dateofWork).startOf('isoWeek').format("MM/DD/YYYY");

        timeentry.save()
            .then(results => { res.status(200).send({ message: `Time Entry saved with id as ${results._id}` }) })
            .catch(error => res.status(400).send(error));
    };

    var getUserProjects = function (req, res) {
        var userId = req.params.userId;

        userProject.findById(userId)
            .then(results => res.status(200).send(results.projects))
            .catch(error => res.status(400).send(error));

    };
    var getTimeEntriesForSpecifiedPeriod = function (req, res) {
      console.log('called3');

        if (!req.params || !req.params.fromdate || !req.params.todate || !req.params.userId) {
            res.status(400).send({ "error": "Invalid request" });
            return;
        }


        let fromdate = new Date(moment.unix(req.params.fromdate));
        fromdate.setUTCHours(0, 0, 0, 1);

        let todate = new Date(moment.unix(req.params.todate));
        todate.setUTCHours(23, 59, 59, 59);
        let userId = req.params.userId;

        TimeEntry.find({
            "personId": userId,
            "dateofWork": { "$gte": fromdate.toISOString(), "$lte": todate.toISOString() }
        },
            ("-rollupYear -rollupMonth -rollupWeek  -createdDateTime"))
            .populate('projectId')
            .sort({ "dateofWork": -1, "lastModifiedDateTime": -1 })
            .then(results => {
                let data = [];
                results.forEach(element => {
                    let record = {};

                    record._id = element._id;
                    record.notes = element.notes;
                    record.isTangible = element.isTangible;
                    record.personId = element.personId;
                    record.projectId = (element.projectId) ? element.projectId._id : "";
                    record.projectName = (element.projectId) ? element.projectId.projectName : "",
                        record.dateOfWork = moment(element.dateofWork).format("MM/DD/YYYY");
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

//To get the timeentries for a specific project
    var getTimeEntriesForSpecifiedProject = function (req, res) {
      console.log('called3');

       if (!req.params || !req.params.fromDate || !req.params.toDate || !req.params.projectId) {
            res.status(400).send({ "error": "Invalid request" });
            return;
        }

console.log(req.params);

        let fromdate = moment.unix(req.params.fromDate).format('YYYY-MM-DD');
        let todate = moment.unix(req.params.toDate).format('YYYY-MM-DD');
        let projectId = req.params.projectId;


        TimeEntry.find({
            "projectId": projectId,
            "dateofWork": { "$gte": new Date(fromdate.toString()), "$lte": new Date(todate.toString()) }
        },
            ("-rollupYear -rollupMonth -rollupWeek -createdDateTime -lastModifiedDateTime"))
            .populate('userId')
            .sort({ "dateofWork": -1 })
            .then(results => {

                res.status(200).send(results);
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

                console.log(`record is ${record}`)

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
        getUserProjects: getUserProjects,
        getTimeEntriesForSpecifiedPeriod: getTimeEntriesForSpecifiedPeriod,
        editTimeEntry: editTimeEntry,
        deleteTimeEntry: deleteTimeEntry,
        getTimeEntriesForSpecifiedProject: getTimeEntriesForSpecifiedProject

    };
};

module.exports = timeEntrycontroller;
