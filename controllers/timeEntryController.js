var express = require('express');
var moment = require('moment');
var userProject = require('../helpers/helperModels/userProjects');

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
                    timeentry.taskId = element.taskId;
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

        var timeentry = new TimeEntry();
        var dateofWork = req.body.dateofWork;
        var date = new Date();
        var timeSpent = req.body.timeSpent;


        timeentry.personId = req.body.personId;
        timeentry.projectId = req.body.projectId;
        timeentry.taskId = req.body.taskId;
        timeentry.dateofWork = moment(dateofWork).format('YYYY-MM-DD');
        timeentry.totalSeconds = moment.duration(timeSpent).asSeconds();
        timeentry.notes = req.body.notes;
        timeentry.isTangible = req.body.isTangible;
        timeentry.createdDateTime = moment.utc();
        timeentry.lastModifiedDateTime = moment.utc();
        timeentry.rollupYear = moment(dateofWork).get('year');
        timeentry.rollupMonth = ("0" + (moment(dateofWork).get('month') + 1)).slice(-2) + moment(dateofWork).get('year');
        timeentry.rollupWeek = moment(dateofWork).startOf('week').format("MM/DD/YYYY");

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

        if (!req.params || !req.params.fromdate || !req.params.todate || !req.params.userId) {
            res.status(400).send({ "error": "Invalid request" });
            return;
        }


        let fromdate = moment.unix(req.params.fromdate).format('YYYY-MM-DD');
        let todate = moment.unix(req.params.todate).format('YYYY-MM-DD');
        let userId = req.params.userId;


        TimeEntry.find({
            "personId": userId,
            "dateofWork": { "$gte": new Date(fromdate.toString()), "$lte": new Date(todate.toString()) }
        },
            ("-rollupYear -rollupMonth -rollupWeek -createdDateTime -lastModifiedDateTime"))
            .populate('projectId')
            .sort({ "dateofWork": -1 })
            .then(results => {
                let data = [];
                results.forEach(element => {
                    let record = {};

                    record._id = element._id;
                    record.notes = element.notes;
                    record.isTangible = element.isTangible;
                    record.personId = element.personId;
                    record.projectId = (element.projectId) ? element.projectId._id : "";
                    record.taskId = element.taskId;
                    record.projectName = (element.projectId) ? element.projectId.projectName : "",
                        record.taskName = function (tasklist, idtofind) {
                            for (var i = 0; i < tasklist.length; i++) {
                                let element = tasklist[i];

                                if (element._id.toString() === idtofind.toString()) {
                                    return element.Description
                                }

                            }

                        }(element.projectId.tasks, element.taskId)


                    record.dateOfWork = moment(element.dateofWork[0]).format("MM/DD/YYYY");
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
            res.status(400).send({ "error": "Bad request" });
            return;
        }

        //verify that requestor is owner of timeentry or an administrator
        let timeEntryId = mongoose.Types.ObjectId(req.params.timeEntryId);

        TimeEntry.findById(timeEntryId)
            .then(record => {

                if (!record) {
                    res.status(400).send({ "error": `No valid records found for ${timeEntryId}` });
                    return;
                }

                if (record.personId === req.body.requestor || req.body.requestor.role === "Administrator") {

                    record.notes = req.body.notes;
                    record.hours = req.body.hours;
                    record.minutes = req.body.minutes;
                    record.isTangible = req.body.isTangible;
                    record.projectId = req.body.projectId;
                    record.taskId = req.body.taskId;

                    record.save()
                        .then(() => {
                            res.status(200).send({ record })
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

                if (record.personId === req.body.requestor || req.body.requestor.role === "Administrator") {

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
        deleteTimeEntry: deleteTimeEntry

    };
};

module.exports = timeEntrycontroller;