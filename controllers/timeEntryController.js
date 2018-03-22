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
            .then(results => { res.status(200).send({ message: "Time Entry saved" }) })
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
            .then(results => {
                let data = [];
                results.forEach(element => {
                    let record = {};

                    record._id = element._id;
                    record.notes = element.notes;
                    record.isTangible = element.isTangible;
                    record.personId = element.personId;
                    record.projectName = (element.projectId) ? element.projectId.projectName : "",
                        record.taskName = (element.projectId) ? element.projectId.tasks.forEach(task => {
                            if (task.id === element.taskId) { task.Description }
                            else { "" }

                        }) : "";
                    record.dateOfWork = moment(element.dateofWork[0]).format("MM/DD/YYYY");
                    record.totalSeconds = formatseconds(element.totalSeconds);

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
        var format = Math.floor(moment.duration(seconds, 'seconds').asHours()) + ':' + moment.duration(seconds, 'seconds').minutes();
        return format;
    }

    return {
        getAllTimeEnteries: getAllTimeEnteries,
        postTimeEntry: postTimeEntry,
        getUserProjects: getUserProjects,
        getTimeEntriesForSpecifiedPeriod: getTimeEntriesForSpecifiedPeriod

    };
};

module.exports = timeEntrycontroller;